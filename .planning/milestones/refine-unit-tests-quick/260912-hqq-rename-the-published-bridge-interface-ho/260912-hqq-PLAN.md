---
phase: 260912-hqq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/bridges/hooks/index.test.ts
  - tests/architecture/hooks-lifecycle.test.ts
autonomous: true
requirements: [IN-02]

estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - The published hooks bridge type is named for the dependency bundle it is, and zero occurrences of the prior identifier remain under extensions/, tests/ or scripts/.
    - The `extends HooksFileReader` relation survives, so the one-member read port is still composed rather than copied into a second declaration.
    - "`npm run check` exits 0 on the renamed tree — typecheck, lint, fallow, format, the corresponding-test pair gates, the direct-coverage negative control, unit tests and integration tests."
    - The three gates the code review flagged as adjacent still pass unchanged - the `hydrateProjectScopeForCwdWith` body regex in `tests/architecture/hooks-lifecycle.test.ts`, the construction-string pins in `tests/index.test.ts`, and the exact-equality `UNOWNED_EXPORT_CENSUS`.
    - No runtime behavior changes - every touched reference is a type position (`import type`, a parameter annotation, a variable annotation, or a `satisfies` operand).
  artifacts:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/bridges/hooks/index.test.ts
    - tests/architecture/hooks-lifecycle.test.ts
  key_links:
    - The `export type { ... }` block in `bridges/hooks/index.ts` must carry the new identifier, or the barrel-importing test stops resolving. The alphabetical slot is unchanged - the new name still sorts between `HooksHydration` and `HooksRouting`.
    - The `satisfies` assertion in `tests/bridges/hooks/index.test.ts:26` is the only proof that the barrel's re-exported type is the same type the declaring module exports. It must keep binding the same object literal.
    - All four production parameter annotations in `event-router.ts` must move in the same edit as the declaration, or `tsc --noEmit` fails on the unconverted ones.
---

<objective>
Rename the published bridge interface `HooksHydrationReader` to `HooksHydrationDeps` in place.

Purpose: closes code-review finding IN-02. The interface is a two-member dependency bundle - one
filesystem read plus one persistence-layer load - not a kind of file reader, so `extends
HooksFileReader` currently asserts an is-a that is only structurally true. The `Deps` suffix has
direct in-repo precedent (`EdgeDeps`, `SpawnDeps`, `ImportDeps`, `LockedStateTransactionDeps`,
`FetchOneDeps`) and clears the Google-style naming rule, which bans only `I` prefixes and
`Interface` suffixes.

Output: 23 renamed references across 5 files. Nothing else.

**Why there is no `tdd="true"` task here.** A type-only rename adds no behavior, so there is no
assertion to write red-first. The compiler is the red-green cycle: `tsc --noEmit` errors on every
reference not yet converted and goes green exactly when the set is complete. The existing suites
that annotate with this type are the regression net, and they must pass unchanged.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/CLAUDE.md
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.claude/rules/typescript-comments.md
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.agents/skills/typescript-google-style-review/SKILL.md
@/home/acolomba/pi-claude-marketplace-refine-unit-tests/.agents/skills/typescript-unit-testing-review/SKILL.md
@extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
@extensions/pi-claude-marketplace/bridges/hooks/index.ts
</context>

<scope_fence>
Measured on the live tree at plan time. Re-verify with the enumeration command in Task 1 rather
than trusting these line numbers.

**23 references, 5 files, all type positions.** No runtime values - nothing to change behaviorally.

Production (7):
- `bridges/hooks/event-router.ts:454` - the declaration
- `bridges/hooks/event-router.ts` - parameter annotations at `:506`, `:693`, `:801`, `:984`
- `bridges/hooks/index.ts:18` - barrel re-export (published surface)

Tests (16):
- `tests/bridges/hooks/event-router.test.ts` - `import type` at `:50` plus 13 annotations
- `tests/architecture/hooks-lifecycle.test.ts` - `import type` at `:39` plus annotation at `:392`
- `tests/bridges/hooks/index.test.ts` - `import type` at `:19` plus `satisfies` at `:26`

Confirmed absent from `docs/`, `README.md`, `CHANGELOG.md` and `scripts/`.

**Out of scope - do not touch:**
- `HooksFileReader` itself, its declaration, its doc comment, and its own call sites.
- The `extends` relation. It is KEPT.
- Parameter and variable names. The four production parameters stay `reader`; the test locals stay
  `reader`, `hydrationReader`, `EMPTY_STATE_READER`. Renaming them is a different change with a
  different diff, and it would obscure the one-identifier rename under review.
- The construction shape at every call site. `createHooksHydration(hooksRuntime, { loadState,
  readHooksJson })` stays exactly as written - `tests/index.test.ts:787-793` pins that string, and
  the pin is built from member names, which a type rename does not reach.
- Inlining the type as an object literal, or moving it to another module. Either would degrade the
  `hydrateProjectScopeForCwdWith` body regex or create a new pairing obligation in
  `scripts/check-corresponding-tests.mjs`.
- Findings IN-01, IN-03 and IN-04. Separate, deliberately excluded.
- Historical planning artifacts under `.planning/phases/`. They record what was true when written.
  `.planning/STATE.md` and `.planning/HANDOFF-refine-unit-tests-open-items.md` describe IN-02 as
  open; the orchestrator updates those, not this plan.
</scope_fence>

<tasks>

<!-- planner-discipline-allow: HooksHydrationReader -->

<task type="tracer">
  <name>Task 1: Rename the interface across every layer in one atomic edit</name>
  <files>extensions/pi-claude-marketplace/bridges/hooks/event-router.ts, extensions/pi-claude-marketplace/bridges/hooks/index.ts, tests/bridges/hooks/event-router.test.ts, tests/bridges/hooks/index.test.ts, tests/architecture/hooks-lifecycle.test.ts</files>
  <action>
    First enumerate the live reference set so the edit is driven by measurement rather than by the
    line numbers in the scope fence:

    `grep -rn 'HooksHydrationReader' extensions tests scripts docs README.md CHANGELOG.md`

    Expect 23 hits across the 5 files named in `files`. If the count or the file set differs, stop
    and report the delta before editing - the tree moved since planning.

    Then rename the identifier `HooksHydrationReader` to `HooksHydrationDeps` at every one of those
    sites, in a single pass, covering all five files together. A rename that lands in production but
    not in the tests leaves the tree uncompilable, so treat this as one indivisible edit.

    Sites, by kind:
    - the `export interface` declaration in `event-router.ts`, keeping `extends HooksFileReader`
    - four parameter type annotations in `event-router.ts`
    - one member of the `export type { ... }` block in `bridges/hooks/index.ts`. Its alphabetical
      slot does not move: the new name still sorts after `HooksHydration` and before
      `HooksRouting`, so do not reorder the block
    - three `import type` specifiers, one per test file. No import source path changes, so
      `import-x/order` sorting is untouched - do not reorder any import block
    - fourteen type annotations and one `satisfies` operand across the three test files

    Review the declaration's doc comment - currently "The hooks read port plus the one
    persisted-state operation hydration additionally needs." That sentence already describes a
    composition of a port with one extra operation, which is what a dependency bundle is, so it
    reads correctly under the new name. Leave it unless you find it now reads wrong. You may add at
    most one sentence recording that the `extends` is member composition rather than a subtype
    claim.

    Hard rule for any comment you write or touch: do not name the prior identifier in source. Both
    the repo comment policy (a comment describes the code as it stands, not the shape it replaced)
    and this plan's zero-occurrence gate forbid it. Keep the existing `D-09-05` and `NFR-10`
    anchors intact and introduce no phase, plan, wave or milestone references.
  </action>
  <verify>
    <automated>npm run typecheck && ! grep -rq 'HooksHydrationReader' extensions tests scripts docs README.md CHANGELOG.md && node --test "tests/bridges/hooks/*.test.ts" "tests/architecture/hooks-lifecycle.test.ts"</automated>
  </verify>
  <done>
    `tsc --noEmit` exits 0. The prior identifier returns zero matches across `extensions`, `tests`,
    `scripts`, `docs`, `README.md` and `CHANGELOG.md`. The three directly-affected test files pass.
    `HooksFileReader` is byte-unchanged, the `extends` relation is present, and no parameter or
    variable was renamed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Prove the full gate chain and the three adjacent gates</name>
  <files>(no edits expected - measurement only)</files>
  <action>
    Run the whole gate chain. This touches published bridge surface and sits next to two
    architecture gates, so the narrow suite from Task 1 is not a sufficient gate on its own:

    `npm run check`

    That chain is typecheck, lint, fallow (dead-code, health, dupes), format:check,
    test:corresponding, test:corresponding:negative, test:coverage:direct:negative, the unit suite
    and the integration suite. Budget roughly 4-5 minutes.

    Then confirm the three gates the code review named as adjacent are green and, importantly,
    still green for the right reason rather than by having stopped looking:
    - `tests/architecture/hooks-lifecycle.test.ts` - its `hydrateProjectScopeForCwdWith` body regex
      matched before and after at plan time, because the named-interface shape is preserved. Confirm
      the assertion that locates the function body still reports a match.
    - `tests/index.test.ts` - the construction-string pins. They are built from member names, so a
      type rename should not reach them. Confirm they are untouched in the diff.
    - `tests/architecture/unowned-exports-census.test.ts` - neither interface appears in the census,
      so the exact-equality pin should not need editing. Re-confirm it passes rather than assuming.

    If lint reports an import or export member-ordering finding, re-sort only within the affected
    braces. Do not move whole import statements and do not restructure a block. If any gate fails
    for a reason that is not member ordering, stop and report rather than widening the change.
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>
    `npm run check` exits 0. `git diff --stat` lists exactly the five files from Task 1 and no
    others - in particular `tests/index.test.ts` and
    `tests/architecture/unowned-exports-census.test.ts` are absent from the diff.
  </done>
</task>

<task type="auto">
  <name>Task 3: Run pre-commit and commit</name>
  <files>(no edits expected - commit only)</files>
  <action>
    Confirm the branch is `features/refine-unit-tests`. Never commit to main.

    Run the hooks over the changed files before attempting the commit, not after:

    `pre-commit run --files <the five changed files>`

    Fix any failure, restage, and re-run until clean. A failed hook means the commit did not happen,
    so never recover with `--amend` and never pass `--no-verify`. Note that the prettier and
    whitespace hooks write to files, so re-check `git status` after the run.

    This checkout is a linked worktree - `.git` is a file, so trufflehog cannot read an index and
    must be skipped. Commit with `SKIP=trufflehog` and stage the five paths explicitly; never
    `git add -A`.

    Conventional Commits message, title at most 72 characters, body lines at most 80. No milestone,
    phase, plan or wave references. Something in the shape of:

    title: `refactor(hooks): name the hydration dep bundle for what it is`

    body: state that the type is a two-member dependency bundle - one filesystem read plus one
    persisted-state load - so the previous name asserted a kind-of-file-reader relationship that was
    only structurally true; note that the composition with the read port is preserved and that every
    changed reference is a type position, so runtime behavior is unchanged; cite `IN-02`.
  </action>
  <verify>
    <automated>test "$(git rev-parse --abbrev-ref HEAD)" = features/refine-unit-tests && SHA=$(git rev-parse HEAD) && SUBJ=$(git log -1 --format=%s "$SHA") && test -n "$SUBJ" && test "${#SUBJ}" -le 72 && FILES=$(git diff --name-only "$SHA^..$SHA") && test "$(printf '%s\n' "$FILES" | wc -l)" -eq 5 && test -z "$(git status --porcelain --untracked-files=no)"</automated>
  </verify>
  <done>
    One commit exists on `features/refine-unit-tests` carrying exactly the five files. No tracked
    file is left modified in the working tree. The commit title is Conventional Commits, at most 72
    characters, and carries no planning references.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| extension ↔ Pi host | The `bridges/hooks/index.ts` barrel is the published surface a host or downstream TypeScript consumer imports from. |
| (none crossed by this change) | No untrusted input, no new parsing, no new disk or network path. Every edited site is a type position erased before runtime. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hqq-01 | Tampering | `bridges/hooks/index.ts` published type export | low | accept | The export is type-only and erased at compile time, so no runtime binding exists to tamper with. A downstream TypeScript consumer pinning the prior name would see a compile error, which is a compatibility cost, not a security one; the identifier is bridge-internal vocabulary and is absent from `docs/`, `README.md` and `CHANGELOG.md`. |
| T-hqq-02 | Tampering | `event-router.ts` hydration path | low | mitigate | The `extends HooksFileReader` relation is kept, so the injected read port stays a required non-optional member with no `DEFAULT_*` fallback. Task 1's scope fence forbids widening the interface or altering the construction shape, and `npm run typecheck` fails closed if any call site stops supplying a member. |
| T-hqq-03 | Denial of Service | the `npm run check` gate chain | low | accept | The rename is type-level only and adds no branch, loop or allocation. The full chain - typecheck, lint, fallow health and dupes, both corresponding-test gates, the direct-coverage negative control, 6109 unit and 32 integration tests - runs in Task 2 before any commit and fails closed on regression. |
| T-hqq-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan. No dependency is added, removed or version-changed, `package.json` and `package-lock.json` are outside `files_modified`, and Task 3's `git diff --stat` gate would surface either file if it were touched. No supply-chain surface is introduced, so the package-legitimacy checkpoint does not apply. |

ASVS level 1, blocking threshold `high`. No threat in this register reaches `high`, so no blocking
security checkpoint is inserted.
</threat_model>

<verification>
1. `npm run typecheck` exits 0.
2. `grep -rn 'HooksHydrationReader' extensions tests scripts docs README.md CHANGELOG.md` returns
   nothing. Run it as a plain grep and read the output, not only the exit code.
3. `grep -rn 'HooksHydrationDeps' extensions tests` returns 23 hits across the same 5 files the
   prior identifier occupied.
4. `grep -n 'extends HooksFileReader' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
   returns exactly one line - the composition survived.
5. `git diff -- extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` shows no change to
   the `HooksFileReader` declaration or its doc comment.
6. `npm run check` exits 0.
7. Capture the new commit's SHA (`SHA=$(git rev-parse HEAD)`) and confirm `git diff --stat
   "$SHA^..$SHA"` lists exactly 5 files. Pin the explicit range rather than a relative anchor -
   this checkout shares a repository with other sessions, so "the commit before HEAD" is not
   reliably this plan's parent.
</verification>

<success_criteria>
- 23 references renamed, 5 files touched, nothing else in the diff.
- `HooksFileReader` unchanged; the `extends` relation preserved.
- No parameter or variable renamed; no construction shape altered; the type stays a named interface
  in its original module.
- `npm run check` green on the committed tree.
- One Conventional Commits commit on `features/refine-unit-tests`, made with `SKIP=trufflehog` after
  a clean `pre-commit run --files` pass, carrying no planning references.
</success_criteria>

<output>
Create `.planning/quick/260912-hqq-rename-the-published-bridge-interface-ho/260912-hqq-SUMMARY.md`
when done. Record the measured reference count, the `npm run check` exit code and duration, and the
commit SHA.
</output>
