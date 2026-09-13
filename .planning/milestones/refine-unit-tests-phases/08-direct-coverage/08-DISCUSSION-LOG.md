# Phase 8: Direct Coverage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-10
**Phase:** 8-direct-coverage
**Areas discussed:** Shortfall ledger form, Stale counts and unenumerated shortfalls, `cleanupStaging` port shape, Gate wiring and Lint blocker

**Mode note:** four gray areas were offered for selection. The operator answered
"choose the recommended option, prefer doing the right thing even if it is more
effort," which selects all four and delegates each choice to the agent with an
explicit bias toward the correct-but-larger option. The tables below record the
alternatives that were live at the point of decision and which one that direction
selected.

---

## Shortfall ledger form

| Option | Description | Selected |
|--------|-------------|----------|
| Must-be-zero gate, close every shortfall | No pin at all; every shortfall removed so the gate can demand complete coverage everywhere | |
| Committed machine-readable pin, exact and bidirectional | The `D-07-19` pinned-snapshot pattern: fails on an addition, a removal, or a swap | ✓ |
| Keep the readings as `CONTRIBUTING.md` prose | Leave the gate untaught, as today, and rely on a human reading the table | |

**User's choice:** Recommended option, taking the more-effort path.
**Notes:** Must-be-zero is not reachable. `ER-F05` and `ER-F19` establish that
exactly two of the known guards yield to a behavior-preserving rewrite; the rest
are narrowing arms that cannot be removed without `!` or `as`, neither of which is
available under this project's rules. (How many "the rest" is stays open — see the
next area.) Prose alone
cannot survive `RCOV-03`, which requires a fail-closed CI job — and
`CONTRIBUTING.md`'s current rationale for not teaching the gate rests explicitly
on there being no CI job ("a job that is red every run reports nothing"). That
premise is what `RCOV-03` retires, so the paragraph is rewritten rather than left
contradicting the code.

The pin survives `RCOV-02`'s "without an allowlist or exclusion" on the
distinction this milestone already litigated in `D-07-19` for the 91-entry
unowned-export census: an allow-list forgives named entries silently and forever;
a pinned set fails in both directions and forces a conscious diff in the same
commit. Recorded as `D-08-05` through `D-08-08`.

Sub-decision: the pin is JSON rather than a `tests/architecture/gate-targets.ts`
constant, because `D-07-07` scoped that registry to `tests/architecture/**` on the
ground that the `.mjs` gate scripts cannot import a `.ts` module — and
`scripts/test-coverage-direct.mjs` is the consumer. This is the same "`.mjs` or
JSON source of truth" Phase 7 named in its own deferred idea.

---

## Stale counts and unenumerated shortfalls

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the roadmap's numbers, note the divergence | Ship against "204 pairs" and "seven shortfalls" with a footnote | |
| Correct to a new fixed count | Amend to 230 pairs and eight shortfalls, classify the eighth, plan against that | |
| Correct the pair count; make the shortfall set an output, not an input | 230 is measurable now; the shortfall set is not knowable until a full report run, so no plan carries a number | ✓ |

**User's choice:** Recommended option, taking the more-effort path.
**Notes:** This area was decided twice, and the second decision is the one that
matters.

The first pass measured `productionPaths()` at **230** (not 204), found
`bridges/commands/discover.ts` short at `branches 55/57, lines 412/414`, and
concluded the answer was "eight shortfalls, correct the counts." The retained
`coverage/all-pairs.jsonl` was also found to hold **83 of 230** rows dated
2026-09-07, having stopped at its first refusal.

Then, while repairing `STATE.md`, a `STATE.md` note named a module the discussion
had not probed: `bridges/hooks/event-router.ts`. Measured, it reads
`branches 107/111, lines 959/967` — uncovered at four separate sites. A **ninth**.

That is what changed the decision. Both gate arms stop at the first refusal, so
every count in circulation — the roadmap's seven, `CONTRIBUTING.md`'s table, and
this discussion's own "eight" — is a count of what was found before the
instrument halted, and hand-probing has no claim to have found the last one. So
`D-08-02` and `D-08-10` refuse to fix a number at all: the enumerating report run
is the answer, and it runs **before** anything is classified, with a second run
after the work lands to generate the pin (`D-08-08`). Two full sweeps, roughly
twenty minutes, which is the price of measuring instead of inheriting.

`bridges/commands/discover.ts` is still classified compiler-forced under
`BC-019` — re-covering it would mean reinstating the `Symbol.hasInstance` surgery
`6527a944 test(06-02): remove bridge builtin mutation` deleted to satisfy
`TREF-08`. `bridges/hooks/event-router.ts` is deliberately left **unclassified**
(`D-08-03a`): four sites with lines as well as branches is not the
single-narrowing-arm signature, no ledger finding authorizes it, and "split
casualty" is a cause rather than a classification.

Recorded as `D-08-01` through `D-08-04a`, `D-08-09a`, and `D-08-10`.

---

## `cleanupStaging` port shape

| Option | Description | Selected |
|--------|-------------|----------|
| Parameter on `cleanupStaging` alone | Smallest change; `cleanupStaging(dir, label, remove)` | |
| Options bag at the bridge stage boundary | Reaches the bridges but arrives as a bag | |
| Named typed collaborator from a production factory, threaded from public entry points | `*Ops` house shape, required parameter, ~40 call sites migrated atomically | ✓ |

**User's choice:** Recommended option, taking the more-effort path.
**Notes:** The narrow options are not merely cheaper, they do not work.
`06-VERIFICATION.md` G1's open remainder is the *interleaved* leak-message
ordering and the leaked-residue partition — both observable only when one
`cleanupStaging` call fails while its siblings succeed, driven from outside
through `commitPreparedSkills` / `prepareStageSkills` and their commands and
agents twins. A port that stops at `cleanupStaging`'s own signature is
unreachable from those tests and closes nothing. G1's override analysis drew that
exact distinction, and it is why the roadmap calls this a phase rather than a gap
fix.

An options bag was rejected under `MF-DEC-07` and `D-05-01`. The collaborator is
required with no default (`D-05-01` forbids a dead default) and every production
caller migrates atomically (`D-06-11` forbids a forwarding seam as an
intermediate state).

Verb set held to `rm` and `rename` — the two operations the G1 leak paths
traverse through `rollbackReplacementCommon`. `lstat`, `stat`, and `readdir` stay
unported: criterion 4 authorizes a removal port, not a filesystem facade, and
those verbs carry no terminal finding. That means the residual builtin-patch
census shrinks rather than closing, and `D-08-14` records that honestly instead
of claiming the class is done.

Recorded as `D-08-11` through `D-08-14`.

---

## Gate wiring and Lint blocker

| Option | Description | Selected |
|--------|-------------|----------|
| Default checkout depth, gate folded into `check` | Smallest CI diff | |
| `fetch-depth: 0`, dedicated CI job, scoped local pre-commit hook, em-dash exclusion widened | Base actually resolves; gate gets its own red signal; Lint goes green so the new hook is verifiable | ✓ |
| Defer the em-dash fix to Phase 9 `CLOSE-01` | Keep this phase's diff narrower | |

**User's choice:** Recommended option, taking the more-effort path.
**Notes:** `actions/checkout` defaults to a depth-1 clone in which `origin/main`
does not exist, so `D-07-13`'s ordered chain silently falls through to `HEAD~1`
and diffs one commit while reporting a resolved base. Fail-closed base selection
is worth nothing if the base it closes on is the wrong one. `fetch-depth: 0` is
already in-repo house practice — `lint.yml`'s `fallow-audit` job uses it for the
same reason.

The em-dash fix was pulled forward from `CLOSE-01` for a mechanical reason, not a
convenience one: `pre-commit run --all-files` is what CI's Lint job runs verbatim
and it is red today, so a new pre-commit hook — this phase's own deliverable —
cannot be verified inside it. Between the two valid fixes, widening the existing
`fix-unicode-dashes` exclusion beats dropping the em-dash from both sides,
because `tests/architecture/revalidation.test.ts` pins the exact bytes
`scripts/revalidation.mjs` emits and those bytes are the `.planning/` house
convention the hook already excludes wholesale. `CLOSE-01` keeps its identity and
records the early closure, the same treatment `D-07-19` gave `ORA-F32`'s instance.

Recorded as `D-08-15` through `D-08-18` and `D-08-20`.

---

## Claude's Discretion

- Exact filename and location of the pin, provided it is committed, outside
  gitignored `coverage/`, and readable by the `.mjs` gate without a `.ts` import.
- Exact name and member names of the removal collaborator and its factory,
  following the `create*` / `create*Fake` conventions.
- Whether the pin comparison lives in `test-coverage-direct.mjs` or a sibling it
  imports, provided `assertCompleteCoverage` stays pure.
- Plan granularity and wave membership, provided the port migration is atomic and
  the pin-generating report run is serialized last.
- Whether the two loop rewrites are one plan or two.

## Deferred Ideas

- `FLOW-05` CRAP integration — already out of scope in REQUIREMENTS.md; unchanged.
- A shared target registry for the two `.mjs` gate scripts — `D-08-06` establishes
  the JSON precedent but does not migrate their path handling.
- `path` builtin patching in `tests/orchestrators/marketplace/add.test.ts` — outside
  the port's verb set, no terminal finding.
- Remaining `lstat` / `stat` / `readdir` patches in `tests/shared/fs-utils.test.ts` —
  same reason.
- Assertion strength for the restored G1 leak paths — belongs to `CLOSE-01`.
- The unused type-member gate — no phase-8 todo match; `D-22` still forbids it.
