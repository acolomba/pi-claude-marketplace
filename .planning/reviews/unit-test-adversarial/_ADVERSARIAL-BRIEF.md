# Adversarial re-review brief

Second-pass brief for a stronger model. Each agent re-examines ONE area that the
first pass already reviewed, treating the first pass's findings file as a set of
**claims to be tested**, not as ground truth.

Repo root: `/home/acolomba/pi-claude-marketplace-unit-test-refactor`

**This is still a DIAGNOSTIC review. Do NOT fix, edit, or reformat any source or
test file.** The only file you write is your own output file. Do not run `npm run
check`, `npm test`, `node --test`, or any build/lint command — other agents run
concurrently and the tree must stay untouched. You may run read-only shell
commands (`grep`, `ls`, `wc`) and short throwaway `node -e` snippets that touch
nothing in the repo.

## Why this pass exists

The first pass was run by a smaller model over a 45-way partition, with single
agents holding files up to 9,431 lines. It produced ~74 BLOCKER and ~355 WARNING
findings. Those findings are cheap to verify — each names a path and a line.

**The untrustworthy output is the `### Clean files` list.** A recorded finding can
be checked. A file declared clean is an unfalsified negative: nothing marks where
the reviewer's attention ran out. Your primary job is to attack those lists.

Your secondary job is to grade the existing findings — including catching ones
that were *understated*, which matters as much as ones that were wrong.

## Step 1 — load the rules

Read in full:

1. `.agents/skills/typescript-unit-testing-review/SKILL.md`
2. `.agents/skills/typescript-google-style-review/SKILL.md`
3. `unit-test-findings/_FIRST-PASS-BRIEF.md`
   — the first pass's brief. It carries the project conventions (pairing rule,
   `extensions/` not `src/`, `tests/` not `test/`, sanctioned exceptions, durable
   spec IDs). Those conventions still apply. Do not re-derive them.
4. `unit-test-findings/META-FINDINGS.md` — the consolidated cross-cutting picture.
   Read it before you start. It tells you which defect classes are already known
   and systemic, so you do not spend your pass re-deriving them, and it names the
   in-repo reference implementations you should compare your area against.

Then read your area's existing findings file, named in your assignment.

## Step 2 — attack the clean lists (primary)

For **every** file on that area's `### Clean files` lists — test and production
alike — do not re-skim for style. Run the mutation test.

### The mutation test

For each exported behavior, ask: **if I made this specific wrong change to the
production code, would any existing case fail?** Work through this catalogue.
A mutation that survives every case is a finding, and the finding is the
*missing assertion*, not the mutation.

**Value mutations**
- Change one field of a returned object to a wrong value of the same type.
- Delete an optional field from a returned object.
- Return a shared reference where a clone is promised (mutate it afterwards).
- Invert a boolean; swap two same-typed fields.
- Reorder a returned list.
- Off-by-one on any limit, cap, truncation, or slice.

**Message and rendering mutations**
- Drop one line from a rendered multi-line message.
- Change one word; change the severity; change the glyph or the token.
- Reorder `<glyph> <name> [scope] (status) {reason}` into a wrong grammar.

**Interaction mutations**
- Skip a collaborator call entirely.
- Call it twice instead of once.
- Call it with one argument wrong.
- Reorder two calls whose order is promised.

**Error mutations**
- Throw a different error class carrying the same message.
- Drop one structured field from the error.
- Swallow the error and return a default instead.

**Control-flow mutations**
- Return early, before a side effect.
- Take the other branch of a condition.
- Remove a `default`/`assertNever` arm and add a union member.

Report each surviving mutation like this:

> **[BLOCKER] `getFoo` can return a wrong `scope` undetected** — `tests/x/foo.test.ts:120`
> Mutating `foo.ts:88` to return `"user"` instead of `record.scope` leaves all 6
> cases green: every case asserts `foo.name` and `foo.status` individually and
> none compares the whole object. Replace the field-by-field checks in the cases
> at lines 118, 140, 166 with `assert.deepStrictEqual(foo, expectedFoo)` against
> a hand-written literal.

### Export ownership census

Separately, enumerate **every export** of each paired production module and map
it to the case(s) that own it. Report any export with no case, and any export
whose only coverage is incidental (exercised as a side effect of another test's
setup, never asserted). State the census as a table — this is the check most
likely to find what a partitioned first pass missed.

### Branch census

For each clean production module, identify branches with no case: error paths,
early returns, defensive fallbacks, `catch` blocks, optional-parameter defaults.
For each, say whether it is (a) reachable and untested — a finding, (b) unreachable
by real input — a production dead-code finding, or (c) compiler-forced and not
removable, which this repo has recorded as a real category (see D-116-01a).
Distinguish these three; do not lump them.

## Step 3 — grade the existing findings (secondary)

For every finding already in the area's file, assign exactly one verdict and cite
the evidence that settles it:

- **CONFIRMED** — real, and the stated severity fits.
- **UNDERSTATED** — real, but worse than recorded. Say why the severity should
  rise, and what the recorded version misses. *Look for these actively.* The
  first pass repeatedly logged a systemic defect as a single grouped WARNING.
- **OVERSTATED** — real but the severity is too high, or it is a style
  preference dressed as a defect. Say what the correct severity is.
- **REFUTED** — not a defect. Cite the file and line that disproves it, or the
  convention that sanctions it. Be specific: "sanctioned by IL-3" beats "seems fine."
- **DUPLICATE-OF** — the same defect is better owned by another area's file. Name
  which file should own it.

Give each verdict one or two sentences. Do not restate the finding at length.

## Step 4 — hunt what a partitioned pass structurally cannot see

The first pass split the tree 45 ways, so each reviewer saw one slice. Within
your area, look specifically for:

- **Sibling drift.** One file diverging from a convention its own siblings follow.
  This was the single most common shape in the first pass — name the sibling that
  already does it right, because that makes the fix propagation, not invention.
- **Cross-file duplicated helpers** that should be one shared module.
- **Tests that belong to another module.** A case exercising a source module other
  than the one its file is paired with. Name the module that should own it.
- **Assertions that drifted from current production behavior** — a case that once
  checked something real and silently stopped. Different from a case that was
  always weak: the fix is to re-derive the intended contract, not to strengthen
  the existing assertion.
- **Doc comments that lie** about a symbol's status. The first pass found both
  directions: a reset hook whose comment falsely claimed production-lifecycle use,
  and a module comment correctly admitting zero production callers.

## Step 5 — write your output

Write `unit-test-findings/adversarial/<SLUG>.md`. **Do not modify the first pass's
file.** Structure:

```markdown
# <Area title> — adversarial re-review

**Scope:** <what you re-examined>
**First-pass file:** `unit-test-findings/<SLUG>.md`
**Clean files attacked:** <count>
**Existing findings graded:** <count>

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | N |
| New WARNING (missed by first pass) | N |
| Existing CONFIRMED | N |
| Existing UNDERSTATED | N |
| Existing OVERSTATED | N |
| Existing REFUTED | N |
| Existing DUPLICATE-OF | N |

## New findings — from the clean lists

### `<path>`
- **[BLOCKER] <title>** — `line NNN`
  <surviving mutation, the case that should have caught it, and the fix instruction>

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `foo.ts` | `getFoo` | `foo.test.ts:118` | owned |
| `foo.ts` | `resetFoo` | — | NO CASE |

## Branch census

<untested branches, each classified reachable-untested / unreachable / compiler-forced>

## Grading of first-pass findings

### `<path>`
- **CONFIRMED** — <first-pass finding title> — <one-line evidence>
- **UNDERSTATED** — <title> — <why it is worse; proposed severity>
- **REFUTED** — <title> — <the file:line or convention that disproves it>

## Still clean after attack

- `<path>` — <the mutations you tried that the cases DO catch>

## Not covered

<anything you could not reach, stated plainly>
```

The **Still clean after attack** section is not a formality. Say which mutations
the cases genuinely catch. A file that survives a named attack is far stronger
evidence than one nobody probed, and it tells the fixing pass where not to spend
time.

## Rules for findings

- Every finding names a path and a line or a `test('…')` title.
- Every finding states what to do, concretely enough to execute without redoing
  the analysis.
- Group repeated instances: one finding, a count, a few representative lines, one
  rule for fixing all of them.
- Do not add style noise. If the first pass logged the repo-wide JSDoc verb-phrase
  drift, do not re-log it per file — reference it once.
- Do not invent findings to look thorough. "Still clean after attack, here are the
  four mutations it catches" is a valuable result.
- Report honestly what you could not reach.

## Step 6 — feed the meta-findings

`unit-test-findings/META-FINDINGS.md` is the consolidated picture the operator
plans from. Your pass can change it, and a discovery that stays in your area file
will not reach that plan.

**Do not edit `META-FINDINGS.md` directly** — dozens of agents run concurrently and
would clobber each other. Instead, end your output file with this section:

```markdown
## Meta-findings impact

### New cross-cutting evidence
<Findings that are NOT local to your area: a defect class that must also exist in
areas you cannot see, a systemic root cause behind several local findings, or a
technique in your area worth propagating repo-wide. State what you found and which
other areas should be checked for it. Omit the section body and write "none" if
your findings are genuinely local — that is a legitimate answer.>

### Corrections to META-FINDINGS.md
<Any claim in META-FINDINGS.md your area contradicts or qualifies. Quote the claim,
give the file:line that settles it, and state the correction. Its "Ranked by
leverage" counts, its reference-implementation table, and its falsified-hypothesis
list are all things your pass can prove wrong — say so plainly if you do.>

### Confirmations
<Claims in META-FINDINGS.md your area independently confirms, with evidence. A
confirmation from a second angle raises confidence; say which claim and how you
verified it.>
```

Be specific and be willing to contradict it. META-FINDINGS.md was synthesized from
45 summaries by an orchestrator that did not read the source. You are reading the
source. Where those disagree, you are more likely right — but show the evidence,
do not merely assert.

A consolidation pass will merge these sections into META-FINDINGS.md after all
agents finish.

## Final reply

Report to the orchestrator: your output path, the verdict-summary counts, whether
the first pass's picture of this area held up (two sentences), and — separately —
anything in your "Meta-findings impact" section that changes the repo-wide picture.
