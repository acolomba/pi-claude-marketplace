# Preservation Decisions

The replacement milestone starts clean. It uses this kit as evidence. It does not inherit
the old phase sequence or assume that the current implementation is correct.

## Classification meanings

- `replay`: preserve the behavior or correction in the replacement design.
- `reconsider`: keep the intent and evidence, but make the design decision again.
- `drop`: do not copy the old mechanism. Preserve its underlying requirement when one
  exists.

The curated decisions in this file override an automated disposition in
`TRANSFORMATIONS.yaml`.

## Replay

### Product invariants

Replay the atomic-write, retry, reload, network, containment, scope, output, and resolver
contracts in `BEHAVIOR-CONTRACTS.yaml`.

Replay the command grammar, error taxonomy, notification grammar, and typed ports in
`PUBLIC-SURFACE.yaml`.

Replay all on-disk formats and migration behavior in `PERSISTENCE-CONTRACTS.yaml`.

### Product corrections found during the refactor

Replay these corrections even if the replacement module layout differs:

| Commit | Preserved correction |
| --- | --- |
| `574862ddec4308a5848e6e3ad6f192659a647116` | Plugin update keeps agent skill preloads. |
| `a6e013a0cee63fbde86a429fb1df4edc8524e3d0` | Plugin update carries bridge staging warnings. |
| `7f22897885ed87db3e2936b3ade486cb00e4f0e7` | Hook exhaustiveness markers survive refactoring. |
| `fbe73c2ac4c176774da80d4164f5d9e2bc8cdefa` | Hook supportability debug logging survives refactoring. |
| `f0db2d5c51af25b37c52ee7e564a41bcd65469fd` | Reconcile isolates each failing entry. |
| `16b863e313518f7cfe98c322bfe24e9de76a5504` | Marketplace reconcile applies every required arm. |
| `1c28fe434d53561fec1af481f63ee83dae8ef8ed` | Plugin and toggle reconcile apply every required arm. |
| `6402801b912e548929831951e25fc45d9dbe0f93` | Device-flow HTTP is a production-reachable port. |

The new milestone must prove each correction through public behavior. It does not need to
cherry-pick these commits.

### Test requirements

Replay these requirements from the new guidelines:

- Each TypeScript source module has one corresponding test module.
- The corresponding test imports and calls its production module.
- Each pair has complete executable line and branch coverage.
- Each case owns its mutable state and temporary directory.
- A test does not require a production export that exists only for tests.
- Interaction verification uses a strong typed mock.
- Each test uses explicit arrange, act, and assert sections.

## Reconsider

### Production module partitions

Reconsider all partitions under these families:

- `domain/resolver/` and `domain/source/`
- `shared/notify/`
- `bridges/hooks/dispatch/` and `bridges/hooks/event-router/`
- `orchestrators/plugin/list/`
- `orchestrators/plugin/shared/`
- `orchestrators/plugin/update/`
- `orchestrators/plugin/info/`
- `orchestrators/plugin/install/`
- `orchestrators/plugin/reinstall/`
- `orchestrators/plugin/enable-disable/`
- `orchestrators/plugin/uninstall/`
- `orchestrators/plugin/fetch/`
- `orchestrators/marketplace/add/`
- `orchestrators/marketplace/update/`
- `orchestrators/marketplace/remove/`
- `orchestrators/marketplace/autoupdate/`
- `orchestrators/reconcile/apply/` and `orchestrators/reconcile/notify/`
- `orchestrators/import/execute/`

`TRANSFORMATIONS.yaml` contains the exact path operations, 674 production symbol-move
candidates, and the intent commits. Use that data to avoid declaration discovery. Decide
the final responsibility boundaries again.

### Test moves

Reconsider every test move and merge. The old work correctly identified many owners, but
the new guidance removes old exemptions and rejects generic helper ownership.

Use the 172 test symbol-move candidates and 393 test path records as an index. Do not copy
the resulting file layout as a fixed design.

### Test doubles and shared contracts

Replay the behavior in `ADAPTER-CONTRACTS.yaml`. Reconsider these implementation choices:

- A generic contract registrar under `tests/helpers/`.
- A separate test file for each fake under `tests/helpers/`.
- A typed global participation inventory.
- Child-process broken-fake probes.

The future design can keep a contract next to the corresponding module and test. It must
still prove production and test-double parity.

### Export reduction

Reconsider every internalized export against real production callers and the new tests.
Keep the rule that a production symbol does not become public only for a test.

The exact unverified candidates are in `DIRTY-CHECKPOINT.patch`.

## Drop

Drop these workstream-specific mechanisms from the replacement design:

- The current mirrored-test exemption model.
- The current sharded direct-LCOV runner and reconcile protocol.
- The current direct-coverage matrix baseline.
- The current ownership disposition registry.
- The current adapter participation scanner.
- The current targeted Fallow coordinate inventory.
- Tests that assert private constants, private regular expressions, or helper visibility.
- Generic helpers that move the subject or its expected value out of the corresponding
  test.

Dropping a mechanism does not drop its purpose. Replace direct-coverage enforcement,
ownership enforcement, and adapter parity with a design that follows the preserved new
guidelines.

## Dirty checkpoint

Do not treat the dirty patch as completed work. It is exact evidence for four candidate
changes:

- Make `HASH_WALK_SKIP` private.
- Remove `SHA_VERSION_RE` and `looksLikeShaVersion` if no production caller needs them.
- Make `getPluginToMarketplacesMap` private.
- Replace private-surface tests with public behavior tests.

The path-hash test writes a shared fixture today. A replacement test must use a case-private
temporary tree.

## Decision required in the new milestone

The supplied project instructions require `installable: true | false` as the resolver
discriminant. Current `main` and the oracle use
`state: "installable" | "partially-available" | "unavailable"`.

Do not hide this conflict inside the test refactor. Resolve it before the new milestone
locks resolver types or corresponding tests. In both designs, the structurally unavailable
arm must not expose `pluginRoot`.

## New-guideline conflicts found in the oracle tree

- The old rule exempts type-only modules and barrels. The new rule does not.
- The old design centralizes many helpers under `tests/helpers/`.
- The tree has no systematic arrange, act, and assert comments.
- The project does not use `strong-mock`.
- Some current tests write shared fixtures or transform a value before the assertion.

These conflicts are reasons for the clean design pass. They are not defects to repair in
this export phase.
