---
phase: 110-domain-and-platform-modules
fixed_at: 2026-09-05T07:05:00Z
review_path: .planning/workstreams/workflows/phases/110-domain-and-platform-modules/110-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 8
skipped: 2
status: partial
verification_ran_in: main checkout (workflow.use_worktrees is false)
---

# Phase 110: Code Review Fix Report

**Fixed at:** 2026-09-05T07:05:00Z
**Source review:** `110-REVIEW.md`
**Iteration:** 1
**Scope:** critical + warning (CR-01, WR-01..WR-09). Info findings were out of scope.

**Summary:**

- Findings in scope: 10
- Fixed: 8 (CR-01, WR-01, WR-02, WR-03, WR-05, WR-06, WR-08, and the substantive
  half of WR-04)
- Redirected rather than applied as proposed: 2 (WR-07 rejected as scoped and
  refiled repo-wide; WR-09 deferred to Phase 111 with a named carrier)
- Partially fixed: 1 (WR-04 — see below; counted under "fixed")

**Verification environment:** the main checkout, not an isolated worktree.
`workflow.use_worktrees` is `false` in `.planning/config.json`, so per that
opt-out no worktree was created and every edit, gate run and commit happened in
`/home/acolomba/pi-claude-marketplace-workflows` on `features/workflow`. The
numbers below are reproducible from the tree as it now stands.

**Gate state on completion:** `npm run check` exits 0 (typecheck, lint, fallow,
format:check, both correspondence gates, the coverage negative control, unit
tests, integration tests). Direct coverage re-measured on all five touched
pairs, all at `hit === found` on every axis:

| pair | branches | functions | lines |
| --- | --- | --- | --- |
| `domain/name.ts` | 50/50 | 6/6 | 288/288 |
| `domain/workflow-script.ts` | 112/112 | 36/36 | 782/782 |
| `domain/workflow-project-key.ts` | 5/5 | 2/2 | 71/71 |
| `platform/workflow-home.ts` | 2/2 | 1/1 | 32/32 |
| `shared/errors.ts` | 104/104 | 48/48 | 675/675 |

---

## READ THIS FIRST: one plan `must_have` is deliberately contradicted

`110-02-PLAN.md` states:

> WNAM-06 (edge, empty): `generatedWorkflowName(plugin, "")` throws, **and so
> does the elision-empties-the-head case** — plugin `acme` with source `acme-`,
> whose elided head is the empty string. Neither may silently produce the bare
> `acme:`.

After WR-02, `generatedWorkflowName("acme", "acme-")` **no longer throws**. It
returns `"acme:acme-"`.

- The first half is unchanged: `generatedWorkflowName("acme", "")` still throws.
- The clause's stated purpose — "Neither may silently produce the bare `acme:`"
  — is still satisfied, and now by construction rather than by refusal.
- The mechanism is D-141-02, the empty-head rule `generatedCommandName` already
  applies to the identical colon join: when elision would empty the head, it
  does not fire and the source stands verbatim.
- A test pinning the old throw was changed. It now pins `"acme:acme-"`.

This is flagged loudly because the verifier reads that `must_have` next and
would otherwise score it as a regression. The rationale is under WR-02.

---

## Fixed Issues

### CR-01: Encoding tests assert only that a pure function is deterministic

**Files modified:** `tests/domain/workflow-script.test.ts`
**Commit:** `101478f3`

The finding is correct as written and was reproduced. Each of the three rows now
pins its verdict, and the replacement-character row is split out because its
outcome genuinely differs:

| row | pinned verdict |
| --- | --- |
| leading U+FEFF byte-order mark | `named`, `acme:ship` |
| lone surrogate in an unrelated literal | `named`, `acme:ship` |
| U+FFFD replacement characters | `refused`, `unparseable` |

The BOM row is the one that matters: a BOM is common in real files, and the old
assertion would have stayed green if a future acorn option turned that row into
`refused`, silently dropping every workflow in a BOM-carrying plugin.

### WR-01: A no-substitution template-literal `meta.name` is resolvable

**Files modified:** `extensions/pi-claude-marketplace/domain/workflow-script.ts`,
`tests/domain/workflow-script.test.ts`
**Commit:** `c1296853`

Verified against the real engine before changing anything. `dist/workflow.js`'s
`evaluateLiteral` has a `TemplateLiteral` arm that throws only when
`node.expressions.length > 0` and otherwise joins `quasi.value.cooked ?? raw`.
So the engine reads `` name: `deploy` `` as `deploy` while we stem-named the
command after its file — measured as
`{"outcome":"stem-fallback","generatedName":"acme:shipper.workflow"}`.

A new `literalString` helper mirrors that arm. The read is static, off text
acorn already parsed, so the module still evaluates nothing and a template with
even one substitution is still denied a name.

One detail worth recording: the helper reads `cooked`, not `raw` — they diverge
the moment an escape appears, and `cooked` is what the engine reads. It does
**not** carry the engine's `?? quasi.value.raw` fallback, because that branch is
unreachable here and would have been an uncoverable branch under the coverage
gate. Verified empirically: acorn rejects a bad escape sequence in an *untagged*
template outright (`Bad escape sequence in untagged template literal`), so such a
script is settled as `unparseable` long before the read and `cooked` is always
present. `String()` folds the type's nullish arm without adding a dead branch,
matching the existing idiom at `name.ts:48`.

Tests: the old template row now expects `named`/`acme:deploy`; a negative row for
`` `a${x}b` `` still falls back; a third row pins that escapes are cooked
(`` `a-b` `` → `acme:a-b`), which a `raw` read would fail.

### WR-02: The name gate is stricter than the engine

**Files modified:** `extensions/pi-claude-marketplace/domain/name.ts`,
`tests/domain/name.test.ts`
**Commit:** `9feac4e7`

This was the judgment call. I unpacked `@quintinshaw/pi-dynamic-workflows@3.10.1`
and checked the safety question the fix hinges on before loosening anything.

**Is `acme:.` actually safe in the engine's own path handling?** Yes, and by the
engine's own rules:

- `isSafeSavedWorkflowName` (`dist/workflow-saved.js:27`) rejects a name that
  **is** `"."` or `".."`, not one that ends in one. `acme:.` and `acme:..` both
  pass all seven of its clauses.
- `sourcePath` (`dist/workflow-saved.js:78`) calls
  `assertSafeSavedWorkflowName(name)` and then `join(dir, `${name}.json`)`. So the
  engine itself accepts these names and writes them as the ordinary one-segment
  files `acme:..json` and `acme:...json`. `..` only normalizes as a whole path
  segment, so neither is traversal.
- `loadFromFile` reads the name from the JSON **content** (`data.name`), never by
  parsing it back out of the filename. There is no round-trip to break.

Nothing downstream in this repo constrains it either: `bridges/workflows/` does
not exist yet and `persistence/locations.ts` has no workflow paths, so no write
path is being widened today.

So the loosening is safe and the invariant in the module's own doc comment —
"Matching the engine exactly is the goal, never exceeding it" — is now true
rather than narrated. The excess came from `assertSafeName` being run on
`source` and on the elided remainder, imposing whole-name rules on parts. Only
the joined name now carries the dot, empty and whitespace rules. The separator
and control screens still catch every part, because `assertSafeName(generated)`
sees them in the join — proven by a new test row (`reports/weekly` →
`Name "acme:reports/weekly" must not contain path separators.`).

The third row (`acme-` → bare `acme:`) took the reviewer's own third option:
D-141-02's empty-head rule, which satisfies both engine parity and the plan's
stated "never silently produce the bare `acme:`". **This contradicts the literal
text of a plan `must_have` — see the section at the top of this report.**

**Measured result.** A differential over 25 sources against the engine's real
`isSafeSavedWorkflowName`, before and after:

| | excess (we refuse, engine accepts) | lax (we accept, engine refuses) |
| --- | --- | --- |
| before | 3 (`acme:.`, `acme:..`, `acme:`) | 0 |
| after | 1 | 0 |

The one remaining excess is deliberate and is the case the plan names: an empty
`meta.name`. The engine's own `validateMeta` requires
`typeof value.name === "string" && value.name.trim()`, so a script declaring
`name: ""` does not load in the engine either — refusing it is engine-consistent
at the level that decides whether the script runs at all.

Doc comments updated to match: `generatedWorkflowName` states the parts-versus-
whole rule and D-141-02; `assertSafeSavedWorkflowName` now says honestly that the
engine's non-empty and dot clauses are satisfied by the *shape* of a
`<plugin>:<name>` join rather than by a check (a check for either could never
fire, and would read as a rule the generator must obey);
`generatedCommandName`'s "Commands only" line now reads "Colon-joined names
only", since workflows share the rule.

### WR-03: `findMetaObject` takes the first `meta` declarator; JavaScript takes the last

**Files modified:** `extensions/pi-claude-marketplace/domain/workflow-script.ts`,
`tests/domain/workflow-script.test.ts`
**Commit:** `f0b21068`

Reproduced: `var meta = {name:"first"}; var meta = {name:"second"};` returned
`{"outcome":"named","metaName":"first"}`. The loop now retains the last matching
declarator, so `findMetaObject` and `readMetaString` share one evaluation model —
which was the actual defect, since `readMetaString` goes out of its way to
document last-wins for properties.

Two cases added: the double-`var` shape, and a later non-object declarator
superseding an earlier object literal. The single-letter `d` became `declarator`
while the function was being rewritten (this is IN-05's neighborhood; no other
IN-05 site was touched).

### WR-04: `generateOrRefuse` catches every throwable — PARTIALLY FIXED

**Files modified:** `extensions/pi-claude-marketplace/shared/errors.ts`,
`extensions/pi-claude-marketplace/domain/name.ts`, `tests/domain/name.test.ts`,
`tests/shared/errors.test.ts`
**Commit:** `c646c6c6`
**Status: fixed — requires human review of the rejected half.**

**Fixed:** the CONVENTIONS.md violation, which is the concrete and verifiable
half. `UnsafeGeneratedNameError` now exists, carries `attemptedName` as data, and
is what `generatedWorkflowName` throws. `assertSafeSavedWorkflowName` raises it
directly rather than being round-tripped through a catch, and only the RN-2 calls
are relabelled — so what the conversion can restate is bounded by one pure string
validator with no dereferences. Callers and tests now discriminate by
`instanceof` instead of `error.constructor === Error` plus an exact message
string. The plugin-name check stays outside the conversion and keeps its bare
`Error`, preserving the "defect of the SET, not of one file" distinction that
`admitWorkflowScript` relies on.

**Not applied:** the reviewer's rethrow guard in `generateOrRefuse`
(`if (!(err instanceof UnsafeGeneratedNameError)) throw err;`). Reason, with
evidence:

1. **It is unreachable.** `generateOrRefuse` is module-private and reached only
   through `admitWorkflowScript`, which pre-screens `pluginName` with the same
   `assertSafeName` predicate at line 129. There is no input for which
   `generatedWorkflowName` throws a non-`UnsafeGeneratedNameError` by the time
   `generateOrRefuse` runs.
2. **The coverage gate forbids the dead branch.** With the guard applied,
   `scripts/test-coverage-direct.mjs` reported
   `Incomplete direct coverage ... branches 105/106, lines 695/697`, the two
   uncovered lines being the guard. I checked for an exemption mechanism:
   `test-coverage-direct.mjs` has none — no allowlist, no accepted-shortfall
   registry. The scope boundary for this task requires those pairs stay at
   `hit === found`, and `110-02-PLAN.md` separately prohibits accepting a
   shortfall on these files.
3. **With the conversion sited at the source, the guard adds nothing.** Since
   `generatedWorkflowName` now converts, the guard would only ever see
   `UnsafeGeneratedNameError` anyway.

Residual, stated plainly so it is not lost: a `RangeError` from the template
concatenation, or the pre-screened plugin throw, would still be reported to the
user as `"<file> resolves to an unusable command name: ..."`. Both are exotic
(the first needs a ~512 MB name) and neither is testable, which is exactly why
the guard cannot be covered. If the project later adopts a coverage-exemption
mechanism, this is the branch to add back.

### WR-05: Untrusted `fileName` and `meta.name` reach `reason` verbatim

**Files modified:** `extensions/pi-claude-marketplace/domain/workflow-script.ts`,
`tests/domain/workflow-script.test.ts`
**Commit:** `95c3e25a`

All three attack strings from the review were reproduced against the real module
before and after. One `forMessage` escaper over `\p{Cc}` and `\p{Cf}` — the same
two classes the engine screens a saved name for — now guards every interpolation
in all nine reason builders.

Measured after the fix:

```
newline filename:  "ok.js\u{a}Installed 5 workflows\u{a} resolves to an unusable command name: ..."
bidi meta.name:    "x.js resolves to an unusable command name: Name \"acme:a\u{202e}b/c\" must not contain path separators."
multiline matched: "y.js calls `new\u{a}\u{a}\u{a}\u{a}\u{a}Date()`, which the workflow engine refuses as nondeterministic"
```

All three now contain no `\p{Cc}` or `\p{Cf}` character anywhere.

One deliberate exclusion: the verdict's own `fileName` field stays verbatim.
That is the file's identity on disk, not text anyone renders, and a consumer that
has to open it needs the real bytes. A test pins that distinction.

The U+202E in the new test fixture is written as the escape `\u202E`, not pasted — the
`texthooks` bidi-control pre-commit hook caught a literal on the first attempt
and was fixed before commit.

### WR-06: The "no match position is carried over" test cannot fail

**Files modified:** `extensions/pi-claude-marketplace/domain/workflow-script.ts`,
`tests/domain/workflow-script.test.ts`
**Commit:** `f698481e`

The `.test()` against the bare vendored literal is gone; whether a script matches
is now decided from the same per-call `g` clone that reports the positions. Two
matchers can disagree about whether a script matched, and the disagreement admits
rather than refuses; one matcher cannot.

The test was rewritten to one occurrence and three scans, and I **planted the
violation to confirm it fails**, which is what CONVENTIONS.md asks of a gate:

- Planting a module-level stateful matcher returned by `determinismScanner()`:
  test still **passed**. Worth recording why — `String.prototype.matchAll` copies
  `lastIndex` into an internal clone and never writes back, so `matchAll` alone
  cannot carry state. This means the reviewer's stated hazard requires the
  `.test()` call specifically.
- Planting the real hazard — a `g` flag on the literal plus the pre-fix
  `.test()`: the test **failed**. The old two-occurrence, two-scan fixture would
  have stayed green against the same plant, exactly as the review said.

### WR-08: `generateOrRefuse`'s `source` parameter means the opposite of `source`

**Files modified:** `extensions/pi-claude-marketplace/domain/workflow-script.ts`
**Commit:** `5fe8cff0`

Renamed to `declaredName`, with the doc comment updated to say why the two must
not share a name in a module whose contract is that script text never becomes a
name.

---

## Redirected Issues

### WR-07: Collision detection compares names as exact strings — REJECTED AS SCOPED, REFILED

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:190-211`
**Commit:** `1df0c12a` (backlog entry `NAMEFOLD-01`)

The underlying observation is **true and I am not disputing it**: the generated
name is a filename (`join(dirs[source], `${name}.json`)`, verified at
`dist/workflow-saved.js:78`), and case-only or normalization-only differences
fold on APFS/HFS+ and NTFS.

What I reject is applying the fold to the workflows gate alone. Evidence:

1. **No sibling gate folds.** `assertNoAgentCollisions`
   (`bridges/agents/convert.ts:605`) is structurally the same function — a `Map`
   keyed on the exact `generatedName` — and agent names become
   `<scopeRoot>/agents/<name>.md`, so agents carry an identical exposure.
   `grep` for `normalize(` / `toLowerCase` across all five bridges returns no
   collision-related hit. Folding one of five leaves a rule that reads as
   arbitrary at the other four.
2. **Folding refuses installs that work.** On a case-sensitive volume — Linux,
   the only platform CI runs — `acme:Ship` and `acme:ship` are two distinct
   working files. A fold converts that into a hard failure for the entire plugin.
   That also runs against this milestone's own design anchor in ROADMAP.md:
   "Nothing in this milestone may turn a gate reading into a refusal."
3. **The right question is a policy one and it is repo-wide:** does this
   extension promise portability across volumes, or validity on this one?

Filed as `NAMEFOLD-01` in `.planning/BACKLOG.md` with the three-gate exposure
table, the two rejected-here reasons, four candidate directions, and a pointer to
the NFC/NFD test that any chosen direction has to retitle. `.planning/WINDOWS.md`
was left untouched per the scope boundary.

### WR-09: Every stem-fallback verdict names a workflow the engine cannot load — DEFERRED TO PHASE 111

**File:** `extensions/pi-claude-marketplace/domain/workflow-script.ts:268-285`
**Commit:** `c3a73bbf`

The finding survives WR-01's fix. One of the five rows (the template literal) now
reads as `named`, but the remaining four still name commands the engine refuses,
and I re-confirmed the rule against `dist/workflow.js:1126`: `validateMeta`
requires both `meta.name` and `meta.description` to resolve to non-empty strings.

Taking the reviewer's own option (b), for two reasons:

- Option (a) — narrowing the stem fallback here — would have this leaf module
  replicate the engine's structural rules, which the module header declines for
  a stated and sound reason (an engine upgrade may drop them). It also cannot
  work: the `description` half is invisible from `meta.name` alone.
- The bridge that writes the envelope is the thing that can warn, and Phase 111
  already owns a `warnings[]` channel (its success criterion 3).

Given a durable carrier rather than prose, per the deferral rule that CONTEXT and
STATE notes evaporate before the later phase reads them:

- A new **Phase 111 success criterion 4** in
  `.planning/workstreams/workflows/ROADMAP.md`, stating the requirement, the
  engine rule behind it, why Phase 110 declined to narrow the fallback, and that
  a test must state it. Following criteria renumbered 5-9.
- A note on `stemFallbackVerdict` itself, so the code carries the decision.

---

## Info findings

Out of scope (`fix_scope: critical+warning`) and not addressed, except that
IN-05's `d` → `declarator` rename happened incidentally inside WR-03's rewrite of
`findMetaObject`. IN-01, IN-02, IN-03, IN-04 and IN-06 are untouched. IN-06
(the `acorn` CHANGELOG line) is tied to the next version bump by CLAUDE.md, not
to this phase.

---

## Scope boundaries observed

- `.planning/WINDOWS.md` — not touched.
- `bridges/workflows/`, `persistence/locations.ts`, `shared/errors-bridges.ts` —
  not touched (Phase 111). `shared/errors.ts` *was* modified, which is in this
  phase's own `files_modified` list; no `"workflows"` member was added to the
  ledger `phase` union.
- `EXTENSION_VERSION` — not bumped, still `0.18.1` (A-03).
- Phase 109's five inverted files — not touched.
- No test-only export, module-global setter, or double-underscore re-export was
  added. `assertSafeSavedWorkflowName` stays module-private.
- No `fallow-ignore` or coverage suppression was added.
- No `--no-verify` and no `--amend`. Every commit ran
  `pre-commit run --files <paths>` to a clean result apart from the documented
  structural `trufflehog` git-mode failure, each confirmed by a filesystem-mode
  scan reporting `verified_secrets: 0, unverified_secrets: 0`, and each committed
  with `SKIP=trufflehog` naming that hook alone.

---

_Fixed: 2026-09-05T07:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
