# Deferred items — phase 01 manifest read fidelity

Out-of-scope discoveries logged during execution. None were fixed.

## `(remote)` rows structurally cannot carry `dependencies`

**Found during:** 01-04 Task 1.

`buildRemoteNotInstalledRow` (`orchestrators/plugin/info.ts`) accepts a
`dependencies` argument and spreads it into the row it returns, but the row is
a `componentsResolved: false` shape and `PluginInfoComponentsUnresolved`
(`shared/notify.ts`) declares no `dependencies` field. The renderer emits the
`dependencies:` line only from the resolved arm, so the value is dropped. The
`(remote)` variant's own doc comment states the contract explicitly: "NO
`dependencies`".

Consequence for D-01-32: a cold git source does fall back to the marketplace
entry internally, but nothing on the rendered row shows it, because no
not-installed git row renders a dependency line at all. Same for every
`(unavailable)` / `(partially-available)` arm, which do not receive the value.

Not fixed here: giving `(remote)` a dependency line is a new catalogued output
state (`docs/output-catalog.md`), which is a closed-set amendment rather than a
free choice. The dead argument is likewise pre-existing.
