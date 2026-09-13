---
quick_id: 260912-vyi
date: 2026-09-12
status: decided
---

# Context — address S3863 and S107

Operator decisions, made 2026-09-13 against measured evidence. **Locked — do not revisit.**

## Measurements taken before the decisions

All four were taken in the orchestrator, unpiped, and are authority for this plan.

### 1. `@typescript-eslint/max-params` at 7 reports exactly the three Sonar found

```
npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'
```

- `bridges/hooks/event-router.ts:595` `tryHydrateOnePlugin` — 10 params
- `orchestrators/reconcile/backfill.ts:335` `maybeBackfillPlugin` — 8 params
- `orchestrators/reconcile/plan.ts:376` `classifyDeclaredPlugin` — 8 params

Total 3. **No fourth offender exists.** Enabling the rule therefore costs nothing
beyond the three fixes already in scope, which is what settled the handoff's
"decide this first" question.

### 2. The S3863 exclusion is inert, and the reason is not any of the three the handoff guessed

Scanner log, CI run `34733874521` (the `sonarcloud` job on PR #181):

- `INFO Project root configuration file: .../sonar-project.properties`
  — the file **is** read.
- `INFO SCM revision ID 'eaf3e9b6d564918f4ec526608a47eb5c2d4fb61a'`
  — the analysis **did** run on the commit that added the exclusion, so the
  unchanged count is a fresh reading, not a stale snapshot.
- `INFO Excluded sources: ...` and `INFO Excluded sources for duplication: ...`
  — the scanner echoes `sonar.exclusions` and `sonar.cpd.exclusions` from that
  same file back into the log.
- **No log line mentions the issue exclusion at all.** `grep -i ignor` over the
  full 7970-line log returns only test names.

`GET api/settings/values?component=acolomba_pi-claude-marketplace` shows no
server-side `sonar.issue.ignore.*` value of any kind, and `sonar.autoscan.enabled`
is `false`.

Read together: the scanner consumes the properties file, applies the other two
exclusion families from it, and drops `sonar.issue.ignore.*` silently. The
remaining route is the SonarCloud UI, under
**Administration > General Settings > Analysis Scope**.

Note the handoff's own first hypothesis — that `resourceKey` should be
`**/*.ts` rather than repeating the source root — is **not** what the evidence
points at. A wrong pattern would still have produced a "Ignoring issues on
multiple criteria"-class log line with zero matches. Getting no line at all is
a different failure.

### 3. The 34 findings are 17 files x 2

Each pair is one value import plus one `import type` from the same module — the
exact shape `CONVENTIONS.md` prescribes and `import-x/order` enforces. Sonar
reports the pair twice, once per statement.

### 4. Current PR #181 finding counts

`GET api/issues/search?...&pullRequest=181&facets=rules` — total 38:
`typescript:S3863` 34, `typescript:S107` 3, `typescript:S7737` 1.

## Decisions

### D1 — S3863: leave the exclusion in place; document that it is inert

**Do NOT remove the `sonar.issue.ignore.multicriteria` block, and do NOT touch
the 17 files' imports.** The source-level fix (merging each pair into one
statement with inline `type` specifiers) was considered and rejected: it would
change the documented convention that type-only imports are grouped last.

Amend the comment block above the exclusion in `sonar-project.properties` so it
records that the exclusion is committed but **not currently in effect**, cites
the measured evidence from section 2 above, and names the UI route as the way to
activate it. Anyone reading the file must not conclude the rule is suppressed.

### D2 — S107: enable `@typescript-eslint/max-params` at 7, then fix all three

Add the rule scoped to `extensions/pi-claude-marketplace/**/*.ts`, mirroring how
the existing Sonar-way block is scoped. Then refactor all three functions so the
rule passes. Order by blast radius, smallest first: `classifyDeclaredPlugin`
(2 call sites), `tryHydrateOnePlugin` (2 call sites), `maybeBackfillPlugin`
(8 call sites).

The rule and the fixes land such that `npm run check` is green at every commit.

### D3 — S7737: include it

Hoist the `{ runPhases }` parameter default in
`orchestrators/plugin/install-outcome.ts:507` to a module-level frozen constant.

## Constraints carried from the handoff

These are not optional and several have already bitten during this milestone.

- Branch is `features/refine-unit-tests`. **Never commit to main. Do NOT merge
  PR #181** — the operator is holding it open.
- This checkout is a **linked worktree** (`.git` is a file), so `trufflehog`
  cannot run. Prefix every commit with `SKIP=trufflehog`.
- Run `pre-commit run --files <changed files>` **before** each `git commit`.
  Never `--no-verify`. Never `--amend` after a hook failure.
- **Run every verify command UNPIPED.** Piping through `tail`/`head` hands the
  chain the pipe's exit status and reports green on a failing command. That trap
  fired three times during this milestone, once inside a verifier.
- No relative git anchors (`HEAD~1`) — other sessions commit to this checkout.
  Capture an explicit SHA and use `$SHA^..$SHA`.
- `npm run check` must stay exit 0. Post-retirement baseline: **5971 unit /
  32 integration**.
- `tests/architecture/hooks-lifecycle.test.ts` matches function signatures with
  regexes, at least one of the form `/async function ...[^{]*\{.../`. An inline
  object-literal type in a parameter list introduces a `{` and can break a
  `[^{]*` regex. Check for a pin on `tryHydrateOnePlugin` before changing its
  signature.
- `tests/architecture/unowned-exports-census.test.ts` compares an export census
  by `deepStrictEqual` — it fails on an addition, a removal, AND a swap. A new
  exported helper or a new exported options type shifts it.
- `tests/index.test.ts` asserts exact construction source strings by
  `deepStrictEqual`. A type rename does not move them; a change to construction
  **shape** does. This is the pin to check before the S7737 hoist.
- Zero `fallow-ignore` suppressions and zero `health.thresholdOverrides` exist
  in the repo. **Do not add either.** Any extracted helper must pass both fallow
  health (cyclomatic 20 / cognitive 15 / unit size 60) and ESLint
  (`sonarjs/cognitive-complexity` 15, `sonarjs/no-identical-functions` 3 —
  near-duplicate helpers fail lint).
- Conventional Commits. Title <= 72 chars, body lines <= 80. No milestone or
  phase references in commit messages.

## How the result gets verified

Locally, the max-params half is now falsifiable, which it was not before:

```
npm run lint
npm run check
```

The S3863 half has no local equivalent and is verified by reading the committed
comment, not by a command.

After any push, the finding counts are anonymously queryable:

```
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=acolomba_pi-claude-marketplace&pullRequest=181&rules=typescript:S107,typescript:S7737"
```

Expect `"total": 0` once the four fixes land and CI re-analyses. S3863 stays at
34 by decision D1 — that is the expected reading, not a regression.
