# Handoff — `features/defaults-enabled`

Written 2026-08-19 when work was paused. Self-contained: nothing here depends on
a chat transcript.

## Where you are

| | |
|---|---|
| Worktree | `/home/acolomba/pi-claude-marketplace/.worktrees/defaults-enabled` |
| Branch | `features/defaults-enabled` |
| vs `origin/main` | 175 ahead, **0 behind** |
| vs `origin/features/defaults-enabled` | **13 commits unpushed** |
| Working tree | clean |
| `npm run check` | green |

The shipped `defaultEnabled` milestone is underneath this. Its workstream record
(`.planning/workstreams/defaults-enabled/STATE.md`) is closed and was left
alone; the work below sits on top of it and is not part of any GSD phase.

## What landed since the merge

```text
73a062f6 refactor: drive the test-only export seams to zero
f3ca2940 refactor: extract the reconcile backfill pass into its own module
d43c81bd refactor: move the reinstall, install and remove projections to their owners
1745b103 refactor: move three reinstall internals to the modules that own them
23868fec docs(backlog): settle FLOW-07's reachability question by measurement
adc87daf style: apply prettier to two merge-resolved lines
dbee3509 Merge branch 'main' into features/defaults-enabled
```

`dbee3509` is the merge of main's whole-repo fallow restructuring. Twelve files
conflicted; each was resolved toward main's extracted shape carrying this
branch's behavior. The substantive one is the row composers — `reasons` is now
a **required** parameter on `renderAvailableRow` / `renderRemoteRow` so each
surface states at its call site whether it forwards, because two tests pin the
central arms as dropping. See the merge commit body.

The four `refactor:` commits are FLOW-09: every `__test_*` re-export and
`_*ForTest` accessor is gone (27 → 0).

## Decisions already made — do not re-litigate

**`production` stays `false`.** It is `false` in `.fallowrc.json` on `origin/main`
and on this branch (identical — the merge took main's config wholesale), paired
with `includeEntryExports: true`. FLOW-06 records why that pairing is the fix
rather than a regression. **The operator is handling `production` in a separate
piece of work.** Do not flip it here, and do not treat the `production: true`
measurements below as a proposal to flip it.

**FLOW-05 (CRAP + real coverage) is not resolvable in this repo cheaply.**
`fallow health --coverage` requires true Istanbul format; the repo is V8-native
end to end (`node --test --experimental-test-coverage` + lcov reporter) with no
`c8`, `nyc` or `babel-plugin-istanbul` installed. Istanbul instruments by
transforming source, which collides with the no-build-step design
(`noEmit: true`, Node runs `.ts` natively). `maxCrap: 0` is the deliberate
posture, not a gap. Left untouched.

**FLOW-07's blocking question is settled.** Fallow's boundary check is NOT
reachability-gated on this codebase — two planted probes (a `domain/` file
importing `orchestrators/` that nothing imports, once as a runtime import and
once as `import type`) were both reported, because `production: false` promotes
every discovered file to an entry point. Recorded in the item. What still blocks
removing the ESLint zone matrix is an **edge-by-edge comparison of the two
allow-lists** — nobody has done it, and "superset" is asserted from zone *count*,
which proves nothing. There is also a standing argument for keeping both gates
(the same one CONVENTIONS.md makes for keeping two cognitive-complexity gates).

## What is open

**FLOW-09 is NOT closed.** The seams are at zero, but that was roughly a fifth
of the gap the item was named for:

| Configuration | Findings |
|---|---|
| `production: true`, at the item's filing | 288 |
| `production: true`, measured 2026-08-18 after the sweep | 94 unused exports + 2 unused files |
| shipping config (`production: false` + `includeEntryExports: true`) | 0 |

The remaining ~94 are ordinary internal helpers exported so a test can reach
them, spread thin (the worst single file contributes one). That is the ~84-site
decision pass the item explicitly warns must not be run mechanically — each site
is a choice between extracting a real module and rewriting the test against the
public interface. Reproduce the measurement with:

```bash
npx fallow dead-code --production --format human
```

That flag is a one-off probe against the committed `false`; it changes nothing.

**Branch hygiene not done** (all deliberate, none blocked):

- 13 commits unpushed. No PR opened.
- `CHANGELOG.md`'s `[Unreleased]` covers the `defaultEnabled` feature only —
  nothing about the merge, FLOW-07 or FLOW-09.
- Version not bumped: `package.json` and `sonar-project.properties` are both
  `0.16.1`. Per CLAUDE.md a bump touches package.json + lockfile +
  `EXTENSION_VERSION` + sonar `projectVersion` + CHANGELOG, and wants
  `npm test` re-run (pre-commit does not run the suite that guards the version).
- The FLOW work was done conversationally, not through a GSD command. No
  planning artifacts were written for it. GSD tooling is absent from this
  worktree (it is gitignored), so `/gsd-*` commands will not run here as-is.

## Verify from cold

```bash
cd /home/acolomba/pi-claude-marketplace/.worktrees/defaults-enabled
npm ci          # only if node_modules is stale; see the trap below
npm run check   # typecheck + lint + fallow + prettier + unit + integration
```

Expected: exit 0, 3567 unit tests, 21 integration tests, fallow clean.

## Environment traps that cost time

**`npm ci` may be required after a merge.** The worktree had
`@earendil-works/pi-coding-agent` 0.83.0 against main's `^0.84.2`, which
surfaced as two bogus `settle.ts` / `settle.test.ts` type errors about a
`"deferred"` stop reason. They were stale dependencies, not a code defect.

**trufflehog cannot run git-mode in a linked worktree** — structural, documented
in CLAUDE.md. Commit with `SKIP=trufflehog` **only after** a clean filesystem
scan:

```bash
TH=$(find "${PRE_COMMIT_HOME:-$HOME/.cache/pre-commit}" -type f -name trufflehog -perm -u+x | head -1)
"$TH" filesystem extensions tests --results=verified,unknown --fail
```

**The pre-commit `prettier` hook WRITES.** It rewrote two lines *during* a
commit, leaving the working tree out of sync with the commit that had just been
made (`adc87daf` is the follow-up). After committing, check `git status` —
a "clean" merge can still leave unstaged formatting behind.

**Source-walk gates follow code, not folders.** Moving a function retargets any
gate that greps a named file. Three fired during this work and were repointed:
the D-99-02a manifest-membership allowlist, the HOOK-04 `MANIFEST_FIELD_REASONS`
anchor, and the D-75-01 force-family prose guard (which caught "force-installed"
in a header comment written during the move — the sanctioned term is
`partially-installed`).

## Where the detail lives

- `.planning/BACKLOG.md` — FLOW-05 / FLOW-07 / FLOW-09 carry the full records,
  including the measurements above.
- Commit bodies — each of the six commits explains its own reasoning; the merge
  commit explains all twelve conflict resolutions.
