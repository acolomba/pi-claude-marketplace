# Handoff — the four remaining Sonar findings on PR #181

**Written:** 2026-09-13 · **Branch:** `features/refine-unit-tests` · **PR:** #181

Four SonarCloud findings remain. They do NOT block: the quality gate reads `OK`, all
nine checks pass, and `mergeStateStatus` is `CLEAN`. Reliability, security and
maintainability all rate `A`. This is optional cleanup, not a fix-before-merge.

A fifth finding class, `typescript:S3863` (34 findings, "imported multiple times"), was
already excluded in `sonar-project.properties` via `sonar.issue.ignore.multicriteria`,
because it is structurally incompatible with the `import type` convention that
`import-x/order` enforces. **Do not touch that exclusion.** These four are different:
they are genuine findings with no local equivalent, so suppressing them would hide
something real.

---

## Why ESLint did not catch these

The project runs 217 `sonarjs` rules at `error` over `extensions/`, which mirrors most
of the Sonar way profile. These four fall in the gap:

| finding | ESLint status |
|---|---|
| `S107` too many parameters | `sonarjs/max-params`, `max-params`, and `@typescript-eslint/max-params` are ALL absent from the config. No rule enforces parameter count at all. |
| `S7737` object literal as parameter default | Not implemented by `eslint-plugin-sonarjs` at any severity. |

**The most valuable outcome of this work may be closing the gap rather than fixing the
three functions.** Enabling `@typescript-eslint/max-params` at 7 for
`extensions/pi-claude-marketplace/**` makes S107 surface at lint time instead of on a
pull request. Decide that first, because it changes whether the three fixes are
one-offs or the start of an enforced rule.

---

## The findings

### S107 — too many parameters (3 findings, MAJOR, 20 min each)

Sonar's maximum is 7.

| # | Function | File:line | Params | Call sites |
|---|---|---|---|---|
| 1 | `tryHydrateOnePlugin` | `bridges/hooks/event-router.ts:595` | **10** | 2 |
| 2 | `maybeBackfillPlugin` | `orchestrators/reconcile/backfill.ts:335` | 8 | 8 |
| 3 | `classifyDeclaredPlugin` | `orchestrators/reconcile/plan.ts:376` | 8 | 2 |

**`tryHydrateOnePlugin` (10 params)** is the worst and the most tractable. Its
signature is:

```
scope, marketplace, pluginId, resolvedSource, hooksJsonPath, hooksDir, cwd,
reader, routingState, generationIsCurrent
```

Those cluster naturally: the first seven describe ONE plugin's hydration target, and
the last three are injected collaborators. An options object for the target plus the
existing three collaborators would read better and land at 4 parameters.

**Caution:** `event-router.ts` is covered by `tests/architecture/hooks-lifecycle.test.ts`,
which matches function signatures with regexes. One of them is
`/async function hydrateProjectScopeForCwdWith[^{]*\{([\s\S]*?)\n\}/` — that targets a
DIFFERENT function, but check for a similar pin on `tryHydrateOnePlugin` before
changing its signature. An inline object-literal type in a parameter list introduces a
`{` and can break a `[^{]*` regex.

**`maybeBackfillPlugin` (8 params, 8 call sites)** carries the widest blast radius.
Its first six parameters are all "which plugin, in which marketplace, in which scope"
plus the two records — a strong candidate for one context object.

**`classifyDeclaredPlugin` (8 params)** takes an accumulator plus seven inputs. The
accumulator is the output channel; the rest are read-only context.

### S7737 — object literal as a parameter default (1 finding, MINOR, 5 min)

`orchestrators/plugin/install-outcome.ts:507`:

```ts
async function executeInstallLedger(
  state: ExtensionState,
  locations: ScopedLocations,
  opts: InstallLedgerOptions,
  capture?: InstallFailureCapture,
  transaction: InstallLedgerTransaction = { runPhases },
): Promise<InstallLedgerContextResult> {
```

The default `{ runPhases }` allocates a fresh object on every call that omits the
argument. The usual fix is to hoist it to a module-level frozen constant and default to
that.

**Read `ARCHITECTURE.md` before changing this.** `runPhases` has exactly ONE production
consumer, and `install-flow.ts` binds the real implementation through a named constant
`REAL_INSTALL_TRANSACTION`. There may already be a hoisted constant to default to, which
would make this a one-line change. Check whether the inline default is deliberate — the
injected-seam design in this file was the subject of Phase 5's injection work, and the
`tests/index.test.ts` construction-string pins assert exact wiring text.

---

## Constraints that apply to any fix here

- Branch is `features/refine-unit-tests`. NEVER commit to main.
- **This checkout is a linked worktree** (`.git` is a file), so `trufflehog` cannot run.
  Prefix commits with `SKIP=trufflehog`. Sanctioned by `CLAUDE.md`.
- `npm run check` must stay exit 0. Current baseline: **5971 unit / 32 integration**.
- `tests/index.test.ts` asserts exact construction source strings by `deepStrictEqual`.
  A type rename does not move them; a change to construction SHAPE does.
- `tests/architecture/unowned-exports-census.test.ts` compares an export census by
  `deepStrictEqual` — it fails on an addition, a removal, AND a swap. A new exported
  helper shifts it.
- Zero `fallow-ignore` dead-code suppressions and zero `health.thresholdOverrides` exist.
  Do not add either. Any extracted helper must pass BOTH fallow health
  (cyclomatic 20 / cognitive 15 / unit size 60) and ESLint
  (`sonarjs/cognitive-complexity` 15, `no-identical-functions` 3 — near-duplicate helpers
  fail lint).
- Run every verify command **UNPIPED**, reading its own exit status. Piping through
  `tail`/`head` hands the chain the pipe's exit code and reports green on a failing
  command. That trap appeared three times during this milestone, including inside a
  verifier.
- No relative git anchors (`HEAD~1`) — parallel sessions commit to this checkout.
  Capture an explicit SHA and use `$SHA^..$SHA`.
- Conventional Commits, title <=72 chars, body lines <=80, no milestone or phase refs.
- `pre-commit run --files <changed>` before each commit; never `--no-verify`, never
  `--amend` after a hook failure.

## Verifying the result

SonarCloud's API is anonymously queryable. After a push:

```bash
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=acolomba_pi-claude-marketplace&pullRequest=181&rules=typescript:S107,typescript:S7737"
```

It reads `"total": 4` today. The finding count is the proof, not the local lint run,
because neither rule has a local equivalent to run.

## Recommended order

1. Decide whether `@typescript-eslint/max-params` gets enabled at 7. If yes, enable it
   first and let the failing lint define the work.
2. `S7737` — smallest, most isolated, 5 minutes.
3. `tryHydrateOnePlugin` — worst offender at 10 params, only 2 call sites.
4. `classifyDeclaredPlugin` — 2 call sites.
5. `maybeBackfillPlugin` — 8 call sites, do it last when the pattern is settled.
