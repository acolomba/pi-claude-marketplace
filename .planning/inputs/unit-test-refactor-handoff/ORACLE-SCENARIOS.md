# Oracle Scenarios

These scenarios state observable behavior. They do not require the current private module
layout. A future test can use a different setup if it proves the same result.

## Command routing

### OR-01: Top-level aliases

Given a complete handler record, route `list` and `ls` through the same list handler.
Route an unknown verb to one error notification with `TOP_LEVEL_USAGE`.

Evidence: `extensions/pi-claude-marketplace/edge/router.ts` and
`tests/edge/router.test.ts`.

### OR-02: Marketplace aliases

Given a complete handler record, route `remove` and `rm` through the same remove handler.
Route `list` and `ls` through the same marketplace list handler.

Evidence: `extensions/pi-claude-marketplace/edge/router.ts` and
`tests/edge/router.test.ts`.

### OR-03: Scope grammar

Accept only `user` and `project` as scope values. Reject an invalid value through the
notification port. Do not add a `local` scope.

Evidence: `extensions/pi-claude-marketplace/edge/args.ts` and
`tests/edge/args.test.ts`.

## Resolution and containment

### OR-04: Non-installable result

Given an unsupported plugin shape, return `installable: false`. Do not expose a usable
`pluginRoot` on that result.

Evidence: `extensions/pi-claude-marketplace/domain/resolver.ts` and
`tests/domain/resolver.test.ts`.

### OR-05: Scope paths

Given `user`, build paths below the Pi agent directory. Given `project`, build paths below
`<cwd>/.pi`. Keep marketplace and plugin data in the selected scope.

Evidence: `extensions/pi-claude-marketplace/persistence/locations.ts` and
`tests/persistence/locations.test.ts`.

### OR-06: Unsafe child name

Given a marketplace, plugin, or clone key that escapes its parent, reject it before any
write. Report the attempted path without writing outside an owned root.

Evidence: `extensions/pi-claude-marketplace/shared/path-safety.ts` and
`tests/shared/path-safety.test.ts`.

## Persistence and migration

### OR-07: Missing state

Given no `state.json`, return an empty version-2 state. Do not create the file during the
read.

Evidence: `extensions/pi-claude-marketplace/persistence/state-io.ts` and
`tests/persistence/state-io.test.ts`.

### OR-08: Invalid state

Given invalid JSON or an invalid normalized schema, fail with the state path and the cause.
Do not replace the invalid file with an empty state.

Evidence: `extensions/pi-claude-marketplace/persistence/state-io.ts` and
`tests/persistence/state-io.test.ts`.

### OR-09: Configuration trichotomy

Given no config file, return `absent`. Given an I/O, parse, or schema error, return
`invalid`. Given valid content, return `valid` and the parsed config.

Evidence: `extensions/pi-claude-marketplace/persistence/config-io.ts` and
`tests/persistence/config-io.test.ts`.

### OR-10: First-run migration

Given populated legacy state and no config, write one version-1 config atomically. Preserve
all marketplace sources, autoupdate choices, and `plugin@marketplace` declarations.

Given a valid or invalid config, do not overwrite it. Given empty state, do not create an
empty config.

Evidence: `extensions/pi-claude-marketplace/persistence/migrate-config.ts` and
`tests/persistence/migrate-config.test.ts`.

### OR-11: Agents index row isolation

Given a valid version-1 envelope with one malformed row, retain valid rows and discard the
malformed row. Reject an unsupported envelope version.

Evidence: `extensions/pi-claude-marketplace/persistence/agents-index-io.ts` and
`tests/persistence/agents-index-io.test.ts`.

## Lifecycle behavior

### OR-12: Update keeps skill preloads

Given an installed generated agent with skill preloads, update its plugin. The generated
agent after the update has the same preloads unless the source changed them.

Evidence commit: `574862ddec4308a5848e6e3ad6f192659a647116`.

### OR-13: Update carries bridge warnings

Given a successful update with non-fatal bridge staging warnings, complete the update and
show the warnings in the result surface.

Evidence commit: `a6e013a0cee63fbde86a429fb1df4edc8524e3d0`.

### OR-14: Reconcile isolates entry failures

Given several reconcile entries and one failing entry, record that failure and continue the
other marketplace, plugin, and toggle entries.

Evidence commit: `f0db2d5c51af25b37c52ee7e564a41bcd65469fd`.

### OR-15: Foreign content survives

Given foreign agent, skill, command, or MCP content, run install, update, or uninstall for a
plugin. Keep the foreign content unchanged.

Evidence: `tests/integration/bridges-foreign-content.test.ts`.

## Version and cache behavior

### OR-16: Path version hash

Given the same plugin tree, return the same `hash-<12hex>` version. Changes below `.git`,
`node_modules`, or `.DS_Store` do not change the result.

The `.git` case in `DIRTY-CHECKPOINT.patch` is unverified. Treat it as a scenario to replay,
not as completed evidence.

### OR-17: Completion cache loss

Given a missing completion cache, rebuild it from authoritative state. Do not fail an
otherwise valid read because an optimization file is absent.

Evidence: `extensions/pi-claude-marketplace/shared/completion-cache.ts` and
`tests/shared/completion-cache.test.ts`.

## Adapter behavior

### OR-18: Production and test-double parity

Run each contract in `ADAPTER-CONTRACTS.yaml` against its production adapter and its test
double. A deliberately broken test double must fail one load-bearing case.

Do not require the future implementation to keep the current generic contract helpers.

## Test-architecture oracles

### OR-19: Corresponding module ownership

For each production TypeScript module, the corresponding test imports and calls that module.
The pair covers every executable line and branch in the production module.

Use the preserved new guidelines as the authority. Do not copy the current exemption list.

### OR-20: Isolated case state

Run a test alone, after another case, and in a different order. The result stays the same.
Each case creates and removes its own temporary files and mutable doubles.
