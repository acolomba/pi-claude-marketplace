# Module port

Branch **`features/workflow-port-wip`** holds the mechanical half of Phases
110-111 as a single commit: the production modules from
`features/workflows-spike` that apply to this branch with no conflict, plus the
three additive edits their imports need.

It is a separate branch and not a commit here because applying it leaves the
tree red, and the two things that make it red are the work of the phases
themselves:

- `npm run typecheck` reports one error. `bridges/workflows/stage.ts` reads
  `componentPaths.workflows`, which does not exist until Phase 109 moves
  `workflows` into the supported tuples. This is the correct failure: the
  bridge cannot compile against a resolver that still calls the kind
  unsupported.
- `npm run test:corresponding` reports 8 violations, one per new module. Phases
  110 and 111 write those owner tests.

## Contents

| File | Origin |
| --- | --- |
| `bridges/workflows/{discover,index,stage,types,unstage}.ts` | verbatim from the spike branch |
| `domain/workflow-{project-key,script}.ts` | verbatim |
| `platform/workflow-home.ts` | verbatim |
| `persistence/locations.ts` | verbatim (main never touched it after the merge-base) |
| `domain/name.ts` | **rewritten**, see below |
| `shared/errors.ts`, `shared/errors-bridges.ts` | the three error classes appended |

## The one place the port is not verbatim

`generatedWorkflowName` is written standalone rather than reusing a shared
colon-name helper.

The spike extracted `generatedColonName` out of `generatedCommandName` and had
both call it. That helper does not exist on this branch, and extracting it now
would be worse than not: main has since taught `generatedCommandName` to handle
`/`-separated nested command paths and an elision that would empty the head
(CM-4, D-141-02). Workflow discovery is flat and non-recursive (WBRG-02), so a
shared helper would pull rules into a caller that can never produce either
shape, and would refactor a function main changed recently for its own reasons.

The port therefore mirrors `generatedSkillName` / `generatedAgentName` instead:
validate, elide the `<plugin>-` prefix, join with `:`, then apply the two host
engine rules RN-2 does not carry (128-character cap, trim equality).

**WNAM-06 needs rewording.** It currently requires the shared helper be "reused
rather than reimplemented". That sentence described a branch where the helper
existed. The requirement it was protecting — that the joining rule not drift
between commands and workflows — is worth keeping; the mechanism it named is
not available.

## Not ported

- `orchestrators/plugin/update-row.ts` — orchestrator wiring, belongs to Phase 113.
- The `phase` union in `shared/errors.ts` does not yet carry `"workflows"`. That
  widening belongs with the sixth ledger phase in Phase 112.
- Every test. `tests/helpers/workflow-home.ts` in particular cannot be ported:
  `tests/helpers/` no longer exists.

## Applying

```bash
git cherry-pick features/workflow-port-wip     # or
git checkout features/workflow-port-wip -- extensions/
```

A patch file was tried first and abandoned: `.patch` content legitimately
carries trailing whitespace, the `trailing-whitespace` pre-commit hook rewrites
it on every commit, and a patch that has lost the leading space on its empty
context lines is invalid. A branch has none of that fragility.

Re-derivable from scratch if the branch is ever lost: the eight new modules and
`persistence/locations.ts` are `git checkout features/workflows-spike -- <path>`,
and the rest is the three appends described above — which live in the branch's
diff, not only in this prose.
