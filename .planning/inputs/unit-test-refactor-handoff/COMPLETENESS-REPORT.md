# Completeness Report

**Status:** Passed
**Checked:** 2026-08-28

The preservation check passed against oracle head
`acdfc07bd01bfb67144f003b3f2f0be9bba5f5d1`.

## Revision and input checks

- The branch-start, content-base, oracle, current-main, and merge-base commits exist.
- The worktree head equals the recorded oracle head.
- Three preserved input copies match their SHA-256 hashes and byte counts.
- `DIRTY-CHECKPOINT.patch` matches SHA-256
  `258cff70aba0fa1f82e021c3d2cd28a133adfbfa0da593d35d25f46e78dbef14`.
- The future branch base remains unset by design.

## Transformation coverage

| Evidence | Count | Check result |
| --- | ---: | --- |
| Changed production paths | 252 | Exact set matches the Git diff. |
| Changed test paths | 393 | Exact set matches the Git diff. |
| Production symbol-move candidates | 674 | Source and target paths exist. |
| Test symbol-move candidates | 172 | Source and target paths exist. |
| Intent commits | 166 | Commit IDs are unique. |

Production path operations contain 117 additions, 134 modifications, and one rename.
Test path operations contain 206 additions, 130 modifications, 23 renames, and 34
deletions.

Production move confidence contains 429 high, 214 medium, and 31 low candidates. Test
move confidence contains 154 high, 12 medium, and six low candidates.

Low-confidence records are search leads. They are not proof of a move.

## Contract and replay coverage

| Evidence | Count | Check result |
| --- | ---: | --- |
| Behavior contracts | 20 | IDs, dispositions, and evidence paths pass. |
| Public surfaces | 8 | IDs, dispositions, and evidence paths pass. |
| Persistence artifacts | 10 | IDs, dispositions, and evidence paths pass. |
| Adapter contracts | 3 | IDs, dispositions, and evidence paths pass. |
| Oracle scenarios | 20 | IDs are unique. |
| Replay steps | 10 | Inputs exist and the dependency graph is acyclic. |

## Open decisions carried forward

- The supplied project instructions require `installable: true | false`.
- Current `main` and the oracle use a three-way `state` discriminant.
- The new milestone must resolve this conflict before it locks resolver tests.
- The four-file dirty patch is unverified and is not a completed transformation.
- The new milestone must select its branch base after a fresh comparison with `main`.

These items do not make the export incomplete. They are explicit decisions for the clean
replacement effort.

## Check command

```bash
node .planning/workstreams/milestone/phases/106-rework-preservation-kit/preservation/check-preservation-kit.mjs
```

The command also runs the generator in check mode. It fails if a generated artifact is
stale or a changed production or test path is missing.
