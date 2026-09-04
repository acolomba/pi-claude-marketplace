# Unit-Test Refactor Preservation Kit

This directory is a standalone handoff from `features/unit-tests-scope`. It preserves the
knowledge that a clean replacement effort needs. It does not preserve the old milestone's
execution state.

## Start here

1. Read `BASELINE.yaml`.
2. Check the hashes of the files under `inputs/`.
3. Read `DECISIONS.md`.
4. Import stable contracts from the three contract manifests.
5. Use `TRANSFORMATIONS.yaml` to avoid declaration and ownership discovery.
6. Use `REPLAY-PLAN.yaml` to order the new milestone.

Do not select a future branch base from this kit without a fresh comparison with `main`.
`BASELINE.yaml` records historical revisions, not a branch-creation command.

## Artifact index

| File | Purpose |
| --- | --- |
| `BASELINE.yaml` | Immutable revisions, source counts, input hashes, and dirty checkpoint identity. |
| `TRANSFORMATIONS.yaml` | Every changed production and test path, symbol-move candidates, and intent commits. |
| `BEHAVIOR-CONTRACTS.yaml` | Stable product and test behavior. |
| `PUBLIC-SURFACE.yaml` | User commands, typed ports, errors, and notification rules. |
| `PERSISTENCE-CONTRACTS.yaml` | Paths, wire formats, migrations, and write semantics. |
| `ORACLE-SCENARIOS.md` | Public given-action-result scenarios for replacement tests. |
| `ADAPTER-CONTRACTS.yaml` | Git, credential, and device-flow parity rules. |
| `DECISIONS.md` | Curated replay, reconsider, and drop decisions. |
| `REPLAY-PLAN.yaml` | Dependency graph for the future milestone. |
| `DIRTY-CHECKPOINT.patch` | Exact unverified four-file patch at export time. |
| `COMPLETENESS-REPORT.md` | Final coverage and consistency result. |
| `inputs/` | Immutable copies of the new guidelines, new rule, and old rule. |

The `.yaml` files use JSON syntax. JSON is valid YAML 1.2. This form keeps generation and
checking deterministic without a YAML runtime dependency.

## Mechanical refresh

Run this command only while the oracle head and dirty checkpoint still match the baseline:

```bash
node .planning/workstreams/milestone/phases/106-rework-preservation-kit/preservation/generate-preservation-kit.mjs
```

Run the complete check with this command:

```bash
node .planning/workstreams/milestone/phases/106-rework-preservation-kit/preservation/check-preservation-kit.mjs
```

The generator refuses to run if `HEAD` differs from the recorded oracle head.

## Interpretation rules

- A public behavior contract overrides a structural move candidate.
- A curated decision in `DECISIONS.md` overrides an automated disposition.
- A low-confidence symbol move is a search lead, not proof.
- The dirty patch is evidence, not completed work.
- A `drop` decision removes the old mechanism. It does not remove the underlying stable
  requirement unless the contract manifest also removes it.
