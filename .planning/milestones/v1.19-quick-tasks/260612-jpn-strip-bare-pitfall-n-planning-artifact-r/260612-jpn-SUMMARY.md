---
phase: quick-260612-jpn
plan: 01
type: execute
wave: 1
status: complete
completed_date: 2026-06-12
commits:
  - 7f2e008  # refactor(comments): drop bare Pitfall N refs from TS comments
  - 8b7817d  # docs(rules): forbid bare Pitfall N planning refs
files_modified:
  - .claude/rules/typescript-comments.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/git-credential.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/config-state-consistency.test.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/no-split-01-cast-reads.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/reconcile-planner-purity.test.ts
  - tests/domain/manifest-cache.test.ts
  - tests/domain/name.test.ts
  - tests/integration/load-reconcile-race.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/state-io.test.ts
  - tests/platform/git-credential.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/transaction/phase-ledger.test.ts
metrics:
  sites_rewritten: 119
  source_files: 12
  test_files: 27
  policy_files: 1
  total_files: 40
  ts_files: 39
  diff_insertions: 133
  diff_deletions: 133
  unit_tests: 1853
  integration_tests: 10
---

# Quick 260612-jpn: Strip bare Pitfall N planning-artifact refs Summary

Removed 119 bare `Pitfall N` planning-artifact references (single-digit
N) from 12 source + 27 test `.ts` files, and amended the TypeScript
comment policy to forbid them going forward.

## What landed

### Sweep (commit `7f2e008`)

39 `.ts` files, 133 insertions / 133 deletions — strictly comments,
test/describe titles, and runtime assertion message strings. No
executable code paths touched. Rewording rules applied (in priority
order, matching the plan):

1. **Sibling ID present on the same line** — drop the `Pitfall N` token
   and let the surviving requirement/decision ID(s) carry the anchor.
   This was the dominant pattern: WB-01, WB-02, A7, MA-9, RECON-04,
   AUTH-09, UAT-05, SPLIT-01, A3, M13, D-13, D-48-A, ATTR-07, ST-1,
   ST-6, SK-2, CM-2, AG-1 — all preserved as the new anchor.
2. **Trailing parenthetical, no other ID** — drop the parenthetical and
   tighten grammar (matching f0ae1af precedent style).
3. **`Pitfall N` was the only anchor** — rephrase as a complete
   sentence describing the behavior (e.g. `// Pitfall 9: missing
   file -> default state` → `// Missing file -> default state`).
4. **Cross-doc references** (`per RESEARCH "Pitfall 4"`, `RESEARCH
   M13 / Pitfall 4`) — drop the token; the surrounding header prose
   already states the WHY.
5. **Multi-line / mid-sentence hits** in `update.ts` — dropped the
   parenthetical glue and reflowed the comment paragraph.
6. **Test titles** — kept the requirement-ID prefix where present
   (`"WB-01 / Pitfall 2: ..."` → `"WB-01: ..."`); dropped the leading
   `"Pitfall N "` token where it was the sole anchor (e.g.
   `"Pitfall 9 loadState on missing..."` →
   `"loadState on missing..."`); did NOT mint new IDs (no `ST-1`
   added — the suite headers already establish the anchor).
7. **Runtime assertion message strings** at the three sites enumerated
   in the plan (`add.test.ts:264`, `autoupdate.test.ts:561`,
   `apply.test.ts:154`) — these strings are in-source documentation,
   not contract substrings asserted elsewhere; reworded the same way
   as test titles.

One small companion: `state-io.test.ts:22` carried a `Pitfall-9`
(hyphen-form) prose reference in the file-header docstring that the
`Pitfall [0-9]` grep did NOT match. With its three sibling
`"Pitfall 9 loadState..."` test titles rewritten to drop the token,
leaving the docstring referring to non-existent "Pitfall-9 cases"
would have read as inconsistent prose, so the docstring was also
reworded ("missing-file / empty-`{}` cases verify ENOENT and
structurally-empty states return the canonical DEFAULT_STATE
shape"). Strictly comment-only edit; no rule violation since the
hyphen form was not in the sweep target pattern.

### Policy amendment (commit `8b7817d`)

`.claude/rules/typescript-comments.md`:

- New `## Forbidden` bullet naming both `Pitfall N` and `Pattern N`
  (single-digit N) as forbidden planning-artifact references, with
  the rationale (per-phase RESEARCH numbering restarts; same token
  means different things in different files; source docs gone;
  hazards gate-enforced by tests).
- New before/after example pair under `## Examples` mirroring the
  existing `Phase NN Plan NN` shape: one line-comment form
  (`// WB-01 / Pitfall 2: ...` → `// WB-01: ...`) and one test-title
  form (`test("Pitfall 9 loadState on missing state.json...")` →
  `test("loadState on missing state.json...")`).
- Allowed section and Domain-language carve-out section untouched.

## Verification evidence

### Post-sweep grep (the load-bearing gate)

```text
$ grep -rE 'Pitfall [0-9]' extensions/ tests/ --include='*.ts'
$ echo $?
1
```

Zero hits, exit code 1 — the sweep is byte-clean against the closed
pattern from the plan's `<done>` clause.

### `npm run check` — GREEN

```text
> npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:integration
```

- `tsc --noEmit`: clean (no TSDoc reference broken by comment edits).
- `eslint .`: clean (Prettier-style wrap holds; no padding-line
  regression from reflow).
- `prettier --check`: clean.
- `node --test "tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts"`:
  **1853 unit tests pass, 0 fail, 0 skipped.**
- Integration tests: **10 pass, 0 fail, 0 skipped** (catalog-uat
  byte-equality gate among them — confirms the comment-only sweep
  did not perturb any rendered token).
- Final exit code: `0`.

### Catalog byte-equality gate

```text
$ git diff --stat docs/
(empty)
```

`docs/output-catalog.md` and every other doc under `docs/` is
byte-unchanged. The catalog-uat test asserting (section, state)
fixture byte-equality against the catalog file PASSED — the hard
constraint that user-rendered output stays byte-identical holds.

### Diff scope spot-check

```text
$ git diff --stat -- '*.ts'
... 39 files changed, 133 insertions(+), 133 deletions(-)
```

Insertions match deletions exactly (token-for-token rewrites). A
manual scan of every `+` / `-` line in the diff confirms every change
is one of: a single-line `//` comment, a JSDoc block-comment line, a
`test(...)` title string, an assert message string, or a comment
inside an interface/type declaration. No executable statements, no
control-flow predicates, no type signatures, no exported identifiers.

## Deviations from plan

None. The plan's task list, rewording rules, and per-rule examples
matched the actual hits 1:1. The two commits use the exact
Conventional-Commits subjects the plan suggested as the natural
two-commit split:

1. `refactor(comments): drop bare Pitfall N refs from TS comments`
2. `docs(rules): forbid bare Pitfall N planning refs`

`pre-commit run` ran cleanly on the sweep batch (`prettier`,
`npm lint`, `npm format check`, `npm typecheck` and the smartquote /
trufflehog / large-file / etc. hooks all passed); the policy commit
ran no hooks (the top-level `exclude: ^(\.claude/|...)` in
`.pre-commit-config.yaml` skips `.claude/` for every hook by design),
so no fix-restage-rerun loop was needed. No `--no-verify` used.

## Closes

f0ae1af's deferred rule-file ruling: that commit body explicitly noted
the bare `Pitfall N` taxonomy was "left untouched pending a rule-file
ruling". The policy amendment in `8b7817d` is that ruling, and the
sweep in `7f2e008` applied it.

## Self-Check: PASSED

- `7f2e008` present: `git log --oneline | grep -q 7f2e008` → 0 (found)
- `8b7817d` present: `git log --oneline | grep -q 8b7817d` → 0 (found)
- `grep -rE 'Pitfall [0-9]' extensions/ tests/ --include='*.ts'`:
  zero hits (exit 1)
- `git diff --stat docs/`: empty
- `.claude/rules/typescript-comments.md` contains `Pitfall N` (3 occurrences)
  and `Pattern N` (1 occurrence)
- `npm run check` final exit code: 0
