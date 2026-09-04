# Start Here

This archive contains evidence for a new unit-test-refactor milestone. It does not contain the old milestone state.

## New branch setup

1. Create a new worktree and a `features/*` branch from the latest `main`.
2. Start a new milestone in that worktree.
3. Extract this directory to `.planning/inputs/unit-test-refactor/`.
4. Read `inputs/typescript-unit-testing-guidelines.md` first.
5. Read `DECISIONS.md`, `REPLAY-PLAN.yaml`, and the contract files.
6. Use `TRANSFORMATIONS.yaml` only for searches about a module or declaration.

Give the new agent this prompt:

> Start a new unit-test-refactor milestone. Treat
> `.planning/inputs/unit-test-refactor/` as imported evidence, not prior milestone
> state. The preserved TypeScript guidelines are authoritative. Preserve all
> `replay` behavior. Decide every `reconsider` item again. Exclude mechanisms
> marked `drop`. First, compare the latest `main` with `BASELINE.yaml`. Then
> resolve the resolver-discriminant conflict. Create fresh requirements and a
> fresh roadmap before you change product or test code.

## Important limits

- Do not create the new branch from a revision in `BASELINE.yaml`.
- Do not apply `DIRTY-CHECKPOINT.patch` automatically. The patch is unverified evidence.
- Do not replay old module boundaries or test locations without a new decision.
- Do not restore mechanisms marked `drop` in `DECISIONS.md`.
- Do not run `check-preservation-kit.mjs` on the new branch. It checks the original oracle head.

The preservation check passed in the original worktree on 2026-08-28, before this archive was created.

The resolver conflict needs a new decision. The project instructions require `installable: true | false`.
The preserved implementation uses `state: "installable" | "partially-available" | "unavailable"`.
