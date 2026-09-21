---
phase: 114-degradation-and-documentation
fixed_at: 2026-09-08T08:25:00Z
review_path: .planning/workstreams/workflows/phases/114-degradation-and-documentation/114-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 114: Code Review Fix Report

**Fixed at:** 2026-09-08
**Source review:** `114-REVIEW.md`
**Iteration:** 1
**Scope:** Critical + Warning (WR-01..WR-06). Zero critical findings existed.

**Summary:**

- Findings in scope: 6
- Fixed: 6
- Skipped: 0
- Out-of-scope Info findings also fixed because a Warning fix made one free: 1 (IN-03)

`npm run check` exits 0. Run unpiped, so the exit code is npm's own and not a
pipeline artifact.

## Commits

| Commit     | Findings              | Files                                                                             |
| ---------- | --------------------- | --------------------------------------------------------------------------------- |
| `f45af2ce` | WR-01, WR-05, WR-06   | `docs/workflows-compatibility.md`, `orchestrators/marketplace/update.messaging.ts`, `.planning/WINDOWS.md` |
| `43632f56` | WR-02                 | `README.md`, `README.es.md`                                                       |
| `7279248c` | WR-03                 | `tests/architecture/no-probe-in-workflows-bridge.test.ts`                         |
| `9f255745` | WR-04, IN-03          | `tests/architecture/source-scan.ts`, `tests/architecture/workflows-marker-coverage.test.ts` |

WR-01, WR-05 and WR-06 share one commit because all three edit overlapping prose
in a single file. Splitting them would have needed interactive staging of three
hunks in one paragraph region, which is a worse trade than one commit whose
message names all three findings separately.

## Fixed Issues

### WR-01: the compatibility doc called a 3.10.1 package "0.x"

**Files modified:** `docs/workflows-compatibility.md`
**Commit:** `f45af2ce`

**Verified the claim first-hand rather than trusting the review.** Two npm
registry reads, this session:

```
$ npm view @quintinshaw/pi-dynamic-workflows versions --json | ...
count 57  first 1.0.0  last 3.10.1  majors 1,2,3
$ npm view @quintinshaw/pi-dynamic-workflows time --json | ...
created 2026-05-30  1.0.0 2026-05-30  3.0.0 2026-07-18  3.10.1 2026-09-03
```

So the "57 published versions" half was right and the "0.x" half was wrong, which
is what the review said. The package is at its third major.

The paragraph's risk argument is that the storage layout carries no stability
promise. That argument does not need the package to be pre-1.0, and stating it on
the true facts makes it stronger rather than weaker: the package is past 1.0 and
has still shipped three majors in fourteen weeks, and semver binds only what a
package **exports** — none of the envelope shape, the cwd-key derivation, the
saved-directory layout or the name validator is exported, so a release of any
size can move them without breaking its own promise. The rewritten sentence says
exactly that and cites the two commands above so the next reader can re-derive it.

The stale "0.x" traces to `114-CONTEXT.md`'s `<specifics>` block ("a 0.x package
with roughly 50 releases since May 2026"), inherited from the archived Phase 105.
That planning artifact records what was believed at discuss time and was left
alone; it is not a published contract.

### WR-02: both README taglines omitted workflows

**Files modified:** `README.md`, `README.es.md`
**Commit:** `43632f56`

One line per file, both on line 12, parity preserved.

- English: `... Supports Claude commands, skills, agents, hooks, MCP servers and workflows.`
- Spanish: `... Admite los comandos, habilidades, agentes, hooks, servidores MCP y workflows de Claude.`

The Spanish keeps `workflows` as the component word, matching the register plan 05
already established for the Features bullet (`Workflows (flujos de trabajo).`,
mirroring `Hooks (ganchos).`). The tagline is a running list of kinds rather than
a bullet with room for a gloss, so no parenthetical was added — the glossed form
sits three lines below it.

Broken Windows entry **#33** (`[workflows-replay] both README taglines still list
five component kinds and omit workflows`) is now `status: fixed`, resolved
2026-09-08.

### WR-03: the no-probe gate screened four symbol names over a hardcoded roster

**Files modified:** `tests/architecture/no-probe-in-workflows-bridge.test.ts`
**Commit:** `7279248c`

Both holes closed.

**Capability, not spellings.** Added two patterns: `getAllTools` and
`ExtensionAPI`. `getAllTools()` *is* the question — the four helper symbols the
gate already refused are all wrappers over it — so refusing the wrappers while
allowing the raw read screened names and not the capability. `ExtensionAPI` is the
only handle from which `getAllTools` is reachable, so refusing it also closes the
being-handed-the-answer route by construction, the way `types.ts` currently closes
it for `StageWorkflowsInput` by each input type remembering to omit `pi`. Verified
first that the bridge carries zero occurrences of either, so neither pattern was
red on arrival.

**Roster derived, not hardcoded.** The scanned set is now every `.ts` file in
`bridges/workflows/`, read at run time, so a module added tomorrow is screened on
the day it lands. `DOCUMENTED_TARGETS` survives as the roster of record — it
carries the per-file rationale the header depends on — and the gate asserts the
two agree. The scan runs *before* the roster assertion so a real violation reports
as a violation rather than as roster drift.

**Negative controls — all three observed failing, then restored.**

```
=== CONTROL 1: inline getAllTools probe planted in stage.ts ===
ℹ pass 0
ℹ fail 1
    extensions/pi-claude-marketplace/bridges/workflows/stage.ts matches
    forbidden raw Pi tool-list read: /\bgetAllTools\b/

=== CONTROL 2: a NEW bridge module lands (envelope.ts) ===
ℹ pass 0
ℹ fail 1
  AssertionError: WDEP-02 / WDEP-03 roster drift: the workflows bridge
  directory no longer matches DOCUMENTED_TARGETS.
  +   'extensions/pi-claude-marketplace/bridges/workflows/envelope.ts',

=== CONTROL 3: unstage.ts renamed away ===
ℹ pass 0
ℹ fail 1
  AssertionError: WDEP-02 / WDEP-03 roster drift: ...
  -   'extensions/pi-claude-marketplace/bridges/workflows/unstage.ts'

=== RESTORED ===
ℹ pass 1
ℹ fail 0
```

Control 1 is the decisive one: that exact planted line is invisible to the four
patterns the gate carried before this change.

### WR-04: the marker-coverage gate's seven cases had no forcing construct

**Files modified:** `tests/architecture/source-scan.ts`,
`tests/architecture/workflows-marker-coverage.test.ts`
**Commit:** `9f255745`

**The construct.** A second case scans `orchestrators/` for the two shapes a
`Dependency[]` derivation actually takes in this tree and asserts set equality
with `SITE_CASES` in **both** directions:

```ts
const DERIVATION_SHAPE =
  /\)\s*:\s*(?:readonly\s+)?Dependency\[\]\s*\{|:\s*Dependency\[\]\s*=\s*\[\s*\]/;
```

The first alternative catches a function whose declared return type is the tuple
(six of the seven sites); the second catches a local mutable accumulator
(`install.ts`, which derives inline inside `composeInstalledRow` rather than in a
dedicated function, plus five sites that use both). Both are **anchored** — the
return-type arm requires the closing paren and the opening body brace, the
accumulator arm requires the `= []` initializer — so a bare type annotation such
as `readonly dependencies: readonly Dependency[];` (two of these live in
`apply-outcomes.ts`) is not counted as a derivation. That anchoring is load-bearing:
a gate that goes red on a purely-typed change invites a suppression rather than a
fix.

The scan mechanic (`filesMatching`) went into `source-scan.ts` beside
`assertNoForbiddenSurface`, because it is the same read-and-strip-comments
machinery asking the opposite question — that one takes a roster and proves a
surface absent, this one discovers a roster from a surface's presence. It asserts
the pattern is not global, since `RegExp.prototype.test` on a `/g` regex advances
`lastIndex` between calls and would silently skip files — the same class of
"green because it checked nothing" this fix exists to close.

**Negative controls — all three observed, then restored.** Per the milestone's own
rule that a forcing construct which has not been seen failing has not been shown
to be one.

```
=== CONTROL A: an EIGHTH derivation lands in orchestrators/plugin/uninstall.ts ===
ℹ pass 1
ℹ fail 1
  +   'extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts',
  actual: [ ...import/execute.ts, plugin/install.ts, plugin/list.ts,
            plugin/reinstall.messaging.ts, plugin/shared.ts,
            plugin/uninstall.ts, plugin/update-row.ts,
            reconcile/apply-outcomes.ts ]

=== CONTROL B: a SITE_CASES entry is deleted (apply-outcomes) ===
ℹ pass 1
ℹ fail 1
  +   'extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts'

=== CONTROL C: a pure TYPE ANNOTATION is added (must NOT false-red) ===
ℹ pass 2
ℹ fail 0

=== RESTORED ===
ℹ pass 2
ℹ fail 0
```

Control A is the failure WR-04 names, and it is the one the previous literal
seven-entry array could not see. Control B proves the reverse direction: a
derivation deleted out from under a case is red too, so a case cannot be left
asserting against nothing. Control C proves the claim the code comment makes
about the anchoring, which would otherwise have been an unverified assertion of
exactly the kind this milestone keeps shipping.

Note on Control A's output: `pass 1 / fail 1`. The *rendered-row* case still
passed — an eighth unmarked site does not make the other seven stop rendering the
marker. That is precisely the gap: before this change, `pass 1 / fail 0` was the
whole story.

### WR-05: the doc stated the marker's `warning` severity unqualified

**Files modified:** `docs/workflows-compatibility.md`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`
**Commit:** `f45af2ce`

**No behavior changed.** Confirmed the asymmetry is pre-existing and deliberate
before touching anything: `grep -rn companionSeverity` returns exactly three
production call sites — `install.ts:1854`, `update.ts:2844`,
`enable-disable.ts:1273` — and `reinstall.messaging.ts:369` documents the
no-raise choice as an existing precedent that `114-CONTEXT.md` explicitly told
this phase to copy rather than "fix".

The doc now says which surfaces raise and which do not: three action surfaces
(standalone install, manual update cascade, standalone enable) raise `info` →
`warning`; the read-only inventory surfaces, the load-time reconcile projection,
`import`, `reinstall` and the autoupdate cascade render the identical marker bytes
at `info`. It states outright that the same plugin can read `warning` from
`install` and `info` from `list` in one session, and that the split is shared with
`requires pi-subagents` and `requires pi-mcp` rather than being particular to
workflows.

The `update.messaging.ts` comment claim was narrowed from "the two surfaces cannot
report one ledger run differently" to "... one ledger run's ROW BYTES differently",
with one added sentence saying the severity channel is per-surface. The two lines
already following it said as much; the sentence above them over-reached.

### WR-06: the doc's engine line-number citations are ungated

**Files modified:** `docs/workflows-compatibility.md`, `.planning/WINDOWS.md`
**Commit:** `f45af2ce`

**Treatment chosen: state the pin, and give the debt a listed subject. The line
numbers stay.** Rationale, since the review offered a different first option:

- The fifteen citations (`grep -n -o 'src/[a-z0-9-]*\.ts:[0-9,-]*'`) are precise,
  first-hand, and already grade-tagged `source-read at 3.10.1` at every site. The
  whole document's discipline is first-hand derivation; replacing verified line
  ranges with symbol names I could not re-verify without re-fetching the tarball
  would trade a precise citation with a known staleness contract for a vaguer one
  with an unstated risk of being wrong right now. Several citations are ranges
  *inside* a function (`src/workflow.ts:1399-1409`, the `process` stub) where the
  range carries information a symbol name does not.
- The defect the review names is real but is a **missing contract**, not a wrong
  fact. So the doc now carries one, in the evidence-grades section where every
  citation's grade word is already defined: the citations are pinned to 3.10.1,
  are not maintained against later releases, and `npm pack
  @quintinshaw/pi-dynamic-workflows@3.10.1` is the version to read. It closes by
  saying that a citation which no longer lands means the engine moved, not that
  the claim was wrong when it was read.
- **No gate was invented.** The review warned against one and REQUIREMENTS.md's
  "Out of Scope" table refuses a dependency on this package on purpose. Gating
  fifteen line numbers would require vendoring or fetching the engine in CI.

Broken Windows entry **#34** (`unmet-truth`, phase 114,
`docs/workflows-compatibility.md:23`) records the debt and names the document as
the subject `WPIN-01`'s machine-checkable re-read has to cover — which is the
second of the two treatments the review offered, and what turns "unrecorded debt"
into recorded debt.

## Out-of-scope finding also fixed

### IN-03: the marker-coverage gate spelled its seven site paths twice

**Commit:** `9f255745` (with WR-04)

**Free, and directly on WR-04's path.** WR-04 required editing the same assertion,
and leaving a second hand-maintained copy of the seven paths inside the fix for
hand-maintained duplication would have been incoherent. The expectation is now
projected:

```ts
assert.deepEqual(
  observed,
  SITE_CASES.map(({ site }) => ({ site, marked: true, clean: true })),
);
```

Only the two booleans are literal. The failing row still names the file to open,
which was the suite's stated design goal.

## Findings deliberately NOT fixed

**IN-01** (`docs/messaging-style-guide.md` 16-vs-19 variant count) — out of scope,
and the review itself endorses the existing deferral: the correct fix is
re-deriving the whole 19-row listing, not editing a count. The logged docs task
remains the right vehicle. No change.

**IN-02** (`workflows-compatibility.md:50`'s clean 2-of-9 split) — out of scope
and not free. It sits in a different section from the three Warning edits to that
file, so it carried no incidental cost saving, and rewriting it well means
reconciling line 50 against the classification table's `partly` rows and line 87 —
a judgement call about the document's argument rather than a mechanical
correction. Left for a docs pass.

**IN-04** (positional `notifications[0]` reads in three gate cases and the install
byte-pair helper) — out of scope. Unlike IN-03 it is not free: it touches four
call sites across two suites, three of them inside the `SITE_CASES` bodies that
WR-04's fix already rewrites the surrounding assertion of, and adding a count
assertion to a full-orchestrator drive risks a real red if any of those surfaces
legitimately emits more than one block today. That needs its own verification
pass, not a ride-along.

## Verification

All gates were run in the **main checkout** (`/home/acolomba/pi-claude-marketplace-workflows`),
not in an isolated worktree. `workflow.use_worktrees` is `false` in
`.planning/config.json`, so no worktree was created and the numbers below are
reproducible from the tree as it stands.

| Check                                                     | Result                                    |
| --------------------------------------------------------- | ----------------------------------------- |
| `npm run check` (final, after all four commits)           | exit 0, run unpiped                       |
| `node --test tests/architecture/no-probe-in-workflows-bridge.test.ts` | pass 1, fail 0                |
| `node --test tests/architecture/workflows-marker-coverage.test.ts`    | tests 2, pass 2, fail 0       |
| WR-03 negative controls (3)                               | all observed red, tree restored           |
| WR-04 negative controls (3)                               | 2 observed red, 1 confirmed no false-red  |
| `pre-commit run --files` on all 8 changed paths           | all hooks passed; no hook modified a file |
| TruffleHog filesystem scan on all 8 paths                 | exit 0, `verified_secrets: 0`, `unverified_secrets: 0` |
| `npm view` re-derivation of the WR-01 version claim       | 57 versions, `1.0.0` → `3.10.1`, 3 majors  |

`pre-commit` reports TruffleHog failed on every run. This checkout is a linked
worktree, so `.git` is a text file and the hook's git-mode scan aborts with
`failed to read index file: ... not a directory`. Structural, per `CLAUDE.md`.
Each commit was preceded by the filesystem-mode scan over exactly the paths being
committed and carried `SKIP=trufflehog`; nothing else was skipped, and
`--no-verify` was never used.

## Constraint compliance

- Branch `features/workflow` throughout; nothing committed to `main`.
- `.planning/workstreams/workflows/STATE.md`, `ROADMAP.md`, `.claude/settings.json`
  and `.codex/config.toml` are untouched. Confirmed by `git log --name-only` over
  the four commits.
- No `package.json`, `package-lock.json`, `sonar-project.properties`,
  `CHANGELOG.md` or version-constant edit (D-114-07).
- Every path staged explicitly; `git add -A` never used. The pre-existing
  modifications in the working tree (the operator's `.claude/settings.json`,
  `.codex/config.toml`, `114-PATTERNS.md`, and the untracked files) were present
  before this session and were left alone.
- Comments and test titles cite requirement and finding IDs (`WDEP-02`,
  `WDEP-03`, `WDEP-04`, `WR-03`, `WR-04`, `IN-03`, `D-98-09`); no phase, plan,
  wave or task references.
- Commit titles are Conventional Commits, 5–72 characters, body lines ≤ 80, with
  no milestone or phase mentions.

## Notes for the operator

**One judgement call worth a second opinion.** WR-06 keeps the fifteen engine
line-number citations and adds a staleness contract instead of dropping them. The
review's first-listed option was to drop them in favour of symbol names. If you
prefer that direction, it is a contained change — re-fetch
`@quintinshaw/pi-dynamic-workflows@3.10.1` with `npm pack` and rewrite the fifteen
sites — but it loses the in-function ranges, and Broken Windows #34 would then
have a smaller subject.

**`ExtensionAPI` in the no-probe pattern list is deliberately broad.** It refuses
the Pi API type outright from the five bridge modules. That is stricter than the
review asked for and stricter than the bridge needs today (it carries zero
occurrences). If a future bridge module has a legitimate reason to name
`ExtensionAPI` for something unrelated to the probe, this pattern will be the one
that fires, and the honest response is to narrow it rather than to add an
exemption.

---

_Fixed: 2026-09-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
