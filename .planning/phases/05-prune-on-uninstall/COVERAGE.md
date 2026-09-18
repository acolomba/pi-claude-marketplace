# Phase 5: API Coverage

No external API integration: this phase is in-repo orchestration over the
extension's own `state.json`, the marketplace and plugin manifests already on
disk, the closed-set notification vocabulary, and the flag catalog. It adds no
package, no HTTP client, no subprocess, and no new git operation; the one new
read path (`orchestrators/plugin/dependency-index.ts`) composes the existing
offline declaration reader and is pinned in the network-free gate.

The deterministic detector returned `detected: false` on the phase scope at
planning time. This declaration is recorded so the `verify:pre` gate has a
resolution on file regardless of how the detector scores the finished plan
bodies, which use "wire" in the tracer-task sense and name the `mcp` bridge
among the artifacts a cascade removes.

**Capabilities added:** `uninstall --prune` (a whole-scope orphan sweep inside the
existing locked uninstall transaction) and the dependents guard on `uninstall`
(both entry points). Both read the `provenance` field Phase 4 persisted and the
`dependencies` declarations Phase 1 and Phase 3 already parse.

**Not in scope, and deliberately so:** a standalone `prune` verb, `--dry-run`,
`-y`, any confirmation prompt, and any network access on the uninstall path
(NFR-5).

*Declared: 2026-09-16*
