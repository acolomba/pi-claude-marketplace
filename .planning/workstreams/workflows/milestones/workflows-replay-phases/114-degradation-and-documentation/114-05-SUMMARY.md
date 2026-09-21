---
phase: 114-degradation-and-documentation
plan: 05
subsystem: docs
tags: [workflows, executable-code, evidence-grades, readme, upstream-citation]
status: complete

requires:
  - "docs/hooks-compatibility.md (structural template)"
  - "docs/output-catalog.md::success-with-workflow-engine-absent"
  - "tests/architecture/workflows-marker-coverage.test.ts"
  - "tests/architecture/no-probe-in-workflows-bridge.test.ts"
  - "tests/orchestrators/plugin/install.test.ts (the byte-equality pair)"
provides:
  - "docs/workflows-compatibility.md (the executable-code contract)"
  - "README.md / README.es.md workflows Features bullet + host-engine prerequisite"
  - "tests/domain/resolver.test.ts::the WINV-01 upstream citation"
  - ".planning/spikes/027-workflow-engine-3-10-1-recheck/README.md (corrected message count)"
affects:
  - "milestone-close: the version bump, CHANGELOG entry and PR remain out of scope"

tech-stack:
  added: []
  patterns:
    - "per-claim evidence grading, with the grade word inside the row or sentence that makes the claim"
    - "first-hand re-derivation of every inherited count from the engine tarball and the shipped Claude Code binary"

key-files:
  created:
    - docs/workflows-compatibility.md
  modified:
    - README.md
    - README.es.md
    - tests/domain/resolver.test.ts
    - .planning/spikes/027-workflow-engine-3-10-1-recheck/README.md

decisions:
  - "Every engine figure was re-derived first-hand rather than transcribed: `npm pack @quintinshaw/pi-dynamic-workflows@3.10.1` was unpacked into a scratch directory outside the repo and read, and `strings -n 8` was re-run over the Claude Code 2.1.251 binary. Nine checks, six `validateMeta` messages, 57 published versions, the 2026-09-03 publish date and both peer floors all reproduce."
  - "The inherited template-literal claim was CORRECTED rather than repeated. The engine does not resolve a substituted template to a different name -- `evaluateLiteral` refuses it at check 8. The true divergence is that the bridge installs the command under `<plugin>:<file stem>`, a name the script never declares, while the engine resolves that script to no name at all. The document states it that way."
  - "The document states the engine's own security caveat verbatim: its comment above `DETERMINISM_PRELUDE` says `vm` is not a security sandbox and names the `.constructor` bypass. Omitting it would have made the sandbox comparison read as a boundary claim, which is the one thing the document must not overstate."
  - "The Claude Code column is populated from the shipped binary rather than left mostly `--`. The 2.1.251 bundle carries Claude's own workflow validator and API prose, which supplied the pure-literal `meta` rule, the identical determinism rule, the 524,288-byte script cap and the documented `agent()`-resolves-to-null contract."
  - "Evidence tags are parenthesised, not bracketed. mdformat escapes `[...]` to `\\[...\\]` when the content holds a code span, which produced visible backslashes in the rendered prose."

metrics:
  duration: "~25m"
  completed: 2026-09-08

actuals:
  tokens: 9657
  tasks: 3
  commits: 3

plan_head_before: 6596e535cbb1a750f4a64bca3bae61c40662d154
---

# Phase 114 Plan 05: The executable-code contract -- Summary

The one bridge that installs third-party JavaScript now has a written
contract. It names the engine that runs the code, states how far that engine's
`vm` realm goes and quotes its authors saying where it stops, tabulates the
eight script shapes that install here and refuse to run there, and grades every
engine claim as measured or read. Both READMEs point at it, the path-bearing
premise carries its upstream citation in the two places that hold it, and the
spike record no longer contradicts its own source.

## What was built

**`docs/workflows-compatibility.md`** (239 lines), mirroring
`docs/hooks-compatibility.md` section for section: H1, purpose, legend,
provenance; `## Manifest and discovery` with `### Admit-versus-run divergence`
and `### Refusal-check classification` under it; per-facet tables for script
semantics, the sandbox and naming; `## Host engine requirements`; `## When the
host engine is absent`; `## Upstream stability`; `## Install-time disposition`;
`## Further reading`.

**Both READMEs**, three additions each, on identical line numbers: a Workflows
Features bullet, a host-engine prerequisite with a scoped install command, and
a link to the new document.

**`tests/domain/resolver.test.ts`**, comment only. The assertions of the
`WINV-01` strict case are byte-identical; the diff is nine comment lines in and
five out.

**`.planning/spikes/027-.../README.md`**, the message-count correction.

## Every number was re-derived, not transcribed

This phase's four predecessors each found an inherited count wrong. Rather than
trust the phase documents, the engine tarball was fetched with `npm pack` into a
scratch directory outside the repository and read directly, and the Claude Code
2.1.251 binary was re-scanned with `strings`. Nothing was installed into
`package.json`.

| Claim in the document | Re-derived from | Result |
|---|---|---|
| nine refusal checks | `src/workflow.ts:1504-1564`, read verbatim | confirmed |
| two replicated, determinism first | the same read, against `domain/workflow-script.ts` | confirmed |
| six `validateMeta` messages | `src/workflow.ts:1611-1626`, read verbatim | confirmed; Spike 027's "four" is wrong |
| 57 published versions, 3.10.1 of 2026-09-03 | `npm view ... versions --json`, `time.modified` | confirmed |
| engine peers `pi-coding-agent >=0.80.8`, `pi-tui >=0.80.6` | `npm view ... peerDependencies` | confirmed |
| this project peers `>=0.80.5`; `acorn ^8.16.0` declared once | `package.json` | confirmed |
| upstream `workflows` is `string \| array`, path-bearing | `strings -n 8` over the 2.1.251 binary | confirmed, both arms |
| the six `isSafeSavedWorkflowName` clauses, no case folding, no normalization | `src/workflow-saved.ts:84-137`, `src/saved-commands.ts:21-27` | confirmed |
| envelopes picked up on `session_start` with no registration hook | `src/saved-commands.ts:119-137`, `src/workflow-saved.ts:287` | confirmed |
| `agent()` throws on the host engine | `src/agent.ts`, ten throw sites, none driven | confirmed as a SOURCE READ only |

The pi.dev URL for the scoped package was checked with a negative control: the
real page returns 200 and names the package, a fabricated sibling path returns
404.

## The `.js` FILE component path, read from the source

Requested by the plan's output contract. `bridges/workflows/discover.ts:360`
reaches the filesystem through `shared/fs-utils.ts::readDirEntriesTolerant`,
which returns an EMPTY array on both `ENOENT` and `ENOTDIR` and rethrows
anything else. A `workflows` component path naming a `.js` file -- legal
upstream, since Claude Code's own schema says "a workflows directory or .js
file" -- therefore reaches `readdir`, gets `ENOTDIR`, and yields zero
candidates. No throw, no warning, no `warnings[]` entry.

Downstream that is indistinguishable from an empty directory:
`install.ts:1816` derives `declaresWorkflows` from
`stagedWorkflowNames.length > 0`, so the plugin installs, declares no
host-engine dependency, and its row carries no `requires
pi-dynamic-workflows` marker.

**This is a silent drop, not a throw, so no Broken Windows entry is owed** --
D-114-02's condition for one was that the file target throws. It is documented
as the first of the five install-time dispositions, alongside the empty
`workflows/` directory case, which lands in exactly the same place for a
different reason.

## The Spanish wording chosen

The operator had an open preference on the Features bullet. **`Workflows
(flujos de trabajo).` was chosen**, parallel to the existing `Hooks
(ganchos).` -- the English component word first, the Spanish gloss in
parentheses. Flipping it to `Flujos de trabajo (workflows).` is a one-line
change; the link text would move with it.

The full Spanish additions:

```markdown
- Workflows (flujos de trabajo). Requiere [@quintinshaw/pi-dynamic-workflows](...). Para más información, consulta [Compatibilidad de workflows](docs/workflows-compatibility.md).
- [@quintinshaw/pi-dynamic-workflows](...) (opcional pero recomendado, `pi install npm:@quintinshaw/pi-dynamic-workflows`)
```

Two further wording choices worth the operator's eye:

- **`Compatibilidad de workflows`** for the link text, following
  `Compatibilidad de hooks`. `Compatibilidad de flujos de trabajo` is the
  fuller translation and reads heavier; the existing Hooks bullet sets the
  precedent for leaving the component word in English.
- **`Requiere`** with the scoped package name as the visible link text, where
  the two existing companion bullets show a bare unscoped name. The scope is
  kept visible on purpose: `pi-workflows` is a different, real npm package, so
  a bare `pi-dynamic-workflows` link text would sit one word away from the
  engine this milestone rejected.

The link target stays the English filename, which is what the Hooks bullet
already does.

## The spike sentence, before and after

Before (`.planning/spikes/027-.../README.md:54-56`):

> Neither matches the source. At 3.10.1 `parseWorkflowScript` refuses a script
> at **nine distinct checks**, and `validateMeta` alone carries four messages,
> for twelve refusal messages in all.

After: the nine checks stand, `validateMeta` throws **six** distinct messages,
each quoted verbatim with its source line, followed by a paragraph stating that
no total is given and why -- check 2's message is acorn's own parser text and is
not enumerable. The check-9 row of the table, which listed four field names,
now points at the six-message list instead.

## WDOC-03 verification result

**Already satisfied; nothing changed.** `package.json` declares `acorn` exactly
once, at `^8.16.0`, in `dependencies` -- not in `devDependencies`,
`peerDependencies` or `peerDependenciesMeta`. The phase diff touches none of
`package.json`, `package-lock.json`, `sonar-project.properties` or
`CHANGELOG.md`, and `package.json` `version` plus `EXTENSION_VERSION` are both
still `0.19.0`. `extensions/pi-claude-marketplace/domain/resolver.ts` is absent
from the whole phase diff; its last commits belong to phase 109.

## Deviations from Plan

### Corrections to inherited claims

**1. [Rule 1 - Wrong claim] The template-literal case does not resolve a different name**

- **Found during:** Task 1, reading `evaluateLiteral` at 3.10.1
- **Issue:** CONTEXT D-114-03 and the plan both say a template-literal
  `meta.name` "is admitted under a DIFFERENT name than the one the engine
  resolves". The engine resolves no name for such a script: `evaluateLiteral`
  throws `template interpolation not allowed in meta.name` at check 8. An
  unsubstituted template is read identically by both sides, so there is no
  divergence there either.
- **Fix:** the document states the true divergence -- the bridge installs the
  command under `<plugin>:<file stem>`, a name the script never declares, while
  the engine resolves the script to no name at all -- and adds that Claude
  Code's own `meta` rules forbid template interpolation too, so the shape is
  one neither runtime accepts.
- **Files modified:** `docs/workflows-compatibility.md`
- **Commit:** d72f5bd1

**2. [Rule 2 - Missing critical content] The engine's own "not a security sandbox" caveat**

- **Found during:** Task 1, reading `src/workflow.ts:405-416`
- **Issue:** the sandbox comparison, presented without the engine's own
  disclaimer, reads as a security-boundary claim. Its authors write that `vm`
  is not a security sandbox and name the `.constructor` bypass -- the same
  escape the comparison measures on the rejected engine.
- **Fix:** the caveat is quoted verbatim under "Installing executable code" and
  cross-referenced from the sandbox table, with the comparison stated as a
  difference of degree.
- **Files modified:** `docs/workflows-compatibility.md`
- **Commit:** d72f5bd1

### Judgement calls

- **Two naming rows were downgraded to `--` on the Claude Code side.** "case
  folding" and "Unicode normalization" were first written `✗` for both
  columns. Claude Code's own workflow-script persistence lowercases when it
  derives a script filename, which is not the command-name path but is close
  enough that a flat "no side folds case" would have been an overclaim. The
  rows now claim only what was read: neither the bridge nor the engine folds or
  normalizes.
- **Unknown upstream behaviors are `--`, not guessed.** Recursion below a
  declared directory, symlink handling and UTF-8 handling are Pi-side facts;
  the sources read say nothing about the upstream side, so the legend gained
  "`--` no equivalent on that side, or not stated by the sources read."
- **The sandbox table's column headers name the two engines, not the two
  hosts.** The subject is which Pi extension to trust with third-party code, so
  a "Claude Code" column would have been empty by construction. The table keeps
  the sibling document's four-column shape and says in the sentence above it
  why its headers differ.

## Observations, not fixed

- **Both README taglines still list five component kinds** ("Supports Claude
  commands, skills, agents, hooks and MCP servers" / "Admite los comandos,
  habilidades, agentes, hooks y servidores MCP de Claude"). The plan scoped this
  task to three additions per file and the tagline is a fourth, so it was left
  alone. It is a one-line change per file, on the same line number in both, if
  the operator wants it in the milestone-close pass.

## Known Stubs

None.

## Threat Flags

None. The document and the READMEs introduce no executable surface. The two
threats the plan's register rated high were mitigated as specified: every
install instruction in all three files names the scoped
`@quintinshaw/pi-dynamic-workflows` (grep-verified at zero unscoped
instructions), and no evidence grade in the document is stated stronger than
its source, with the `agent()` source read explicitly labelled as not driven at
runtime.

## Verification

| Check | Result |
|---|---|
| `node --test tests/architecture/no-stale-test-citations.test.ts` | pass 1, fail 0 |
| `node --test tests/domain/resolver.test.ts` | tests 159, pass 159, fail 0 |
| `node --test tests/architecture/peer-floor.test.ts` | tests 2, pass 2, fail 0 |
| `pre-commit run --files` on all five files | clean; no hook modified a file |
| trufflehog filesystem scan on all five files | `verified_secrets: 0`, `unverified_secrets: 0` |
| grep gates on the document (3.10.1, Spike 027, scoped package, both floors, no stale gate phrase, no unscoped install line) | all pass |
| README bullet parity | 10 top-level bullets each, on identical line numbers |
| `npm run check` | green |

`pre-commit` reports TruffleHog as failed in every run: this checkout is a
linked worktree, so `.git` is a file and the hook's git-mode scan aborts with
`failed to read index file: ... not a directory`. That is structural, per
`CLAUDE.md`. Each commit was preceded by a filesystem-mode scan over exactly the
paths being committed and carried `SKIP=trufflehog`, and nothing else was
skipped.

`npm run check` chains its six stages with `&&`, so reaching the final stage
proves the five before it exited zero; the final stage was then re-run alone and
its exit code confirmed as 0, so the green is not a piped-exit-code artifact.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | d72f5bd1 | `docs/workflows-compatibility.md` |
| 2 | 47f9ac79 | both READMEs |
| 3 | 4d038d4c | the resolver test citation and the spike correction |

## Self-Check: PASSED

- `docs/workflows-compatibility.md` -- FOUND
- `README.md`, `README.es.md`, `tests/domain/resolver.test.ts`,
  `.planning/spikes/027-workflow-engine-3-10-1-recheck/README.md` -- FOUND,
  all four carry this plan's changes
- commits d72f5bd1, 47f9ac79, 4d038d4c -- FOUND in `git log`
- every `tests/...` path the document cites resolves on disk, checked by the
  gate rather than by eye
