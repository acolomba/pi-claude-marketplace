# Pitfalls Research

**Domain:** Pi extension translating Claude plugin marketplaces into Pi-native artefacts (skills, prompts, agents, MCP servers); atomic file ops + soft-dependency lifecycle **Researched:** 2026-05-09 **Confidence:** HIGH for V1-derived pitfalls (PRD §6.9-§6.12 documents them); MEDIUM for 2026-specific (Node ≥22, ESM, APFS) and successor-architecture pitfalls (extrapolated from V1 surface + current-ecosystem research)

This document focuses on pitfalls a successor architecture must avoid. Each pitfall references PRD requirement IDs where applicable so phase planning can map them to acceptance criteria. Pitfalls already explicitly addressed by V1 are still listed when the successor must preserve the guard, because removing or refactoring the guard is the most common way pitfalls return.

## Critical Pitfalls

### Pitfall 1: Cross-device rename silently breaking atomic-staging contract

**What goes wrong:** `fs.rename(tmpPath, destPath)` returns `EXDEV: cross-device link not permitted` when `tmpPath` and `destPath` live on different filesystems (or different APFS volumes that look like one disk). On macOS this is endemic when `~/.pi/agent/` lives on the system volume but a project lives on an external/firmlinked volume, or when `/tmp` is a separate tmpfs on Linux. A naive `EXDEV` fallback (`copyFile + unlink`) silently downgrades the operation from atomic to non-atomic -- exactly the property AS-1 / NFR-1 require.

**Why it happens:** `rename(2)` is a POSIX syscall that requires source and destination to share a filesystem. Developers conflate "same directory tree" with "same filesystem"; macOS APFS firmlinks and Docker bind-mounts make this assumption fail invisibly. Anthropic's own `claude-code` has shipped bugs from this exact pattern (issue #40351 -- non-default APFS volume firmlink).

**How to avoid:**

- **Always derive `tmpDir` from the destination's parent**, not from `os.tmpdir()`. The PRD already mandates this for staging (AS-1: "tmp dir on the same filesystem as the destination"). Codify as `stagingDirFor(destPath)` helper that returns `path.join(path.dirname(destPath), '.staging-<random>')` or `<extensionRoot>/agents-staging/`.
- **NEVER fall back to `copyFile + unlink` on EXDEV** without explicitly logging that atomicity was lost. Treat EXDEV as a misconfiguration error that names the two filesystems and refuses to proceed.
- **Add a smoke test** that intentionally places `tmpDir` on a different mount and asserts the operation fails loudly rather than degrading.

**Warning signs:**

- Tests pass on a developer's `~/` but fail in CI containers where `/tmp` is tmpfs
- "It works on macOS but not Linux" reports -- usually means a hardcoded `/tmp` somewhere
- Any code that catches `err.code === 'EXDEV'` and continues

**Phase to address:** Atomic staging phase (PRD §6.11 AS-1, AS-3). Add EXDEV refusal as a single helper used by every staging path: skills, prompts, agents, MCP, state.json, sourceClone.

______________________________________________________________________

### Pitfall 2: Atomicity ≠ durability -- `fs.rename` survives the call but not the crash

**What goes wrong:** `fs.rename` is atomic at the syscall level (other readers see either old or new), but the durability of the rename across an OS crash requires `fsync(parent_dir_fd)` after the rename. Without it, on ext4 or APFS, the `state.json` swap can appear to succeed, the user sees "Installed", and a kernel panic 30s later reverts to the pre-rename state.json -- while the staged files (already fsynced or written first) remain on disk. Result: state.json says "not installed" but resources/skills/foo-bar/SKILL.md exists. Next install of the same plugin trips PI-6 (cross-plugin name conflict) on its own orphaned files.

**Why it happens:** Documentation conflates "atomic" with "durable". POSIX rename guarantees ordering, not that the metadata reaches disk. Linux filesystems (ext4) added heuristics to mitigate the worst cases, but APFS does not -- and on macOS, even `fsync` is documented as a no-op in many cases (Apple recommends `F_FULLFSYNC` via `fcntl` for true durability).

**How to avoid:**

- After every state-mutating rename, **`fsync` the parent directory** (Node's `fs.fsync` works on directory FDs opened with `fs.open(dir, 'r')` on POSIX). On macOS, additionally apply `F_FULLFSYNC` via `fs.fcntl` if available, or accept the documented limitation.
- For `state.json` specifically, write file → fsync file → rename → fsync parent. This is the `write-file-atomic` recipe; consider using that library directly rather than re-implementing.
- **Add a recovery path**: on load, if state.json is missing but `state.json.tmp` exists, treat the partial write as inconclusive and surface a warning (never silently promote a tmp file).
- Document the durability-vs-atomicity distinction in `docs/architecture/atomic-writes.md` so future contributors don't strip the fsync.

**Warning signs:**

- Tests run on tmpfs (which is volatile by design and masks fsync absence)
- Reports of "I installed X, my laptop crashed, now state.json says X is uninstalled but the skill files are still there"
- Code review comments suggesting "fsync is slow, we don't need it for non-critical writes"

**Phase to address:** State persistence + atomic ops phase (PRD §6.9 ST-1, §6.11 AS-1). Pair with NFR-3 (idempotent retry) -- durability gaps amplify retry hazards.

______________________________________________________________________

### Pitfall 3: Soft-dependency probe coupling to companion tool names that can rename

**What goes wrong:** RH-3 hardcodes `subagent` as the tool name probed for `pi-subagents`; RH-4 hardcodes `mcp` as the tool name (or substring `pi-mcp-adapter` in `sourceInfo.source`). If `pi-subagents` v2 renames the tool to `subagent2` or `agent`, the probe returns false, every install with agents starts emitting the "pi-subagents is not loaded" warning, and users mass-file bug reports. Worse: if a third-party extension publishes a tool also named `subagent`, the probe returns true even when `pi-subagents` is not installed, and the warning is suppressed when it should fire.

**Why it happens:** The probe contract is implicit -- it lives in pi-claude-marketplace's source, but the source-of-truth (the tool name) lives in pi-subagents. There's no shared interface package, no version pin, no deprecation channel. The PRD §6.8 captures the contract but no mechanism enforces it.

**How to avoid:**

- **Make the probe contract explicit and versioned.** Define a small `companionExtensionContract.ts` that documents: `pi-subagents@>=X publishes tool 'subagent'`, `pi-mcp-adapter@>=Y publishes tool 'mcp' OR sourceInfo.source~/pi-mcp-adapter/`. Tag each probe with the assumed contract version so a future drift can be flagged.
- **Probe by capability, not by string.** Ask `pi.getAllTools()` for any tool exposing capability `claude-marketplace:subagent-bridge` (a published convention). pi-subagents would advertise this in its tool metadata; if absent, fall back to the legacy name probe with a warning to upgrade pi-subagents.
- **Add an integration test that exercises the probe against the actual current `pi-subagents` and `pi-mcp-adapter` binaries** (not a stub). Run weekly in CI to catch upstream renames within days, not at next user report.
- **Document the probe contract in pi-subagents and pi-mcp-adapter READMEs** as a downstream consumer note: "pi-claude-marketplace probes for tool name `subagent`; renaming this tool is a breaking change for marketplace integration."

**Warning signs:**

- pi-subagents or pi-mcp-adapter major version bumps without coordinated PR to pi-claude-marketplace
- Warning text appearing for users who *do* have the companion installed
- Probes that work in unit tests (where the tool is mocked) but fail in integration tests

**Phase to address:** Reload-hint + soft-dep probing phase (PRD §6.8 RH-3/RH-4). Successor-architecture concern -- V1 ships the hardcoded names; the contract-versioning improvement is what differentiates a successor.

______________________________________________________________________

### Pitfall 4: Foreign-content guard (AG-5) bypassed by partial frontmatter or marker-string drift

**What goes wrong:** AG-5 protects user-owned agent files from accidental deletion by requiring two checks before remove: (a) basename starts with `claude-marketplace-`, (b) body contains literal marker `generated by pi-claude-marketplace` in an HTML-comment block immediately after the frontmatter. If the marker text changes ("generated by pi-claude-marketplace v2", different capitalization, comment moved), every legitimate agent file generated by an older version becomes "foreign content" and uninstall refuses to remove it. PU-7 then routes those entries into `failed[]` -- uninstall fails loudly across the user base on a string typo.

**Why it happens:** The marker string is a stable user contract (ES-5) but lives only as a string literal in source. Refactors that touch the marker (e.g., adding version info, switching from `<!-- -->` to `{# #}`) lose the original verbatim text without realizing it is load-bearing.

**How to avoid:**

- **Promote ES-5 marker strings to a `MARKERS.ts` constants module** with a comment block citing PRD §6.12 ES-5 verbatim. Lint rule (ESLint custom rule or grep-based pre-commit hook) refuses any other source file from string-literal-matching the marker.
- **Snapshot test every marker** against the verbatim PRD text. Test name: `MARKERS.AGENT_GENERATED matches PRD §6.12 ES-5`. Failure of this test should be unmissable in CI.
- **The detector for AG-5 must accept any historically-shipped marker variant.** If the marker is ever changed, the *new* code emits the new marker but the *removal* code accepts both old and new. Document the migration window.
- **Add a `migrate-markers` subcommand or load-time scan** that, on detecting an old marker, rewrites the file in-place to the new marker with provenance preserved (and logs at warning severity).

**Warning signs:**

- Any PR diff touching agent-file write paths
- Refactor PRs labeled "improve provenance comment"
- Bug reports about uninstall failing on multiple agents simultaneously after upgrade

**Phase to address:** Agents bridge + error-surface phase (PRD §5.7 AG-5, §6.12 ES-5). Marker stability is part of the user contract -- schedule alongside ES-5 marker testing.

______________________________________________________________________

### Pitfall 5: State migration evolves schema mid-flight while another process writes the legacy form

**What goes wrong:** ST-4/ST-5 mandate load-time migration of legacy records (missing `manifestPath`/`marketplaceRoot`/`resources.agents`/etc.). Process A loads state.json v0, migrates in memory to v1, starts a long-running install. Meanwhile Process B (a separate Pi process) loads the same state.json v0, migrates, starts an uninstall. Both call `withStateGuard`, which re-reads on entry -- but if A commits between B's read and B's migration, B may overwrite A's v1 commit with B's stale v0-derived v1 (any field A added that B didn't know about gets dropped). Worse: if `schemaVersion: 2` is introduced mid-deploy (one Pi is upgraded, one isn't), the v1 process will downgrade v2 state on every save.

**Why it happens:** `withStateGuard` (ST-7) protects against lost updates *within a single schema version* but not across versions. The PRD assumes `schemaVersion: 1` for V1; the successor will eventually need v2, and the migration model has no protocol for "I cannot safely write this file because it's a future version".

**How to avoid:**

- **`withStateGuard` MUST refuse to save a state with a `schemaVersion` lower than what was on disk at entry.** If on-disk is v2 and the loaded-and-migrated copy is v1 (because this binary doesn't know v2), throw `StateSchemaDowngradeError` and surface a clear "upgrade pi-claude-marketplace; another Pi process committed a newer state schema" message.
- **`schemaVersion` bumps must be additive-only across one minor.** Add fields, never rename or remove. Removal/rename requires a major schema bump with a deprecation window where both readers exist.
- **Persist the migrated form aggressively at load time** (already best-effort per ST-4) so the on-disk form converges to the latest known schema before any other process can race against it.
- **Add a state-schema integration test** that simulates "older version reads state written by newer version" and asserts the older version refuses-with-guidance rather than corrupts.

**Warning signs:**

- Bug reports of "fields disappearing from state.json after running command X"
- A schema migration PR that touches both reader and writer in the same commit without a deprecation period
- `withStateGuard` callers that mutate fields outside the migration whitelist

**Phase to address:** State persistence phase (PRD §6.9 ST-4, ST-7, ST-8, ST-9). Schema evolution is a successor-architecture concern (PRD has no v2 yet); plan it before adding the second schema version, not after.

______________________________________________________________________

### Pitfall 6: Concurrent `marketplace remove` cascade vs. `install` of a plugin in that marketplace

**What goes wrong:** PI-15 and PU-5 cover concurrent install/uninstall of the *same plugin*. They do NOT explicitly cover: A is mid-install of plugin `pl@mp` while B is doing `marketplace remove mp`. A's state-guard reads state with `mp` present, stages all resources, then on commit reads state again -- `mp` is now gone. The install proceeds to add a plugin record under a marketplace that no longer exists. Subsequent operations see an orphaned install record with no parent marketplace. Worse: B's cascade unstaged plugins it knew about but couldn't see A's in-flight one, so A's staged files leak.

**Why it happens:** `withStateGuard`'s mutual exclusion is at the closure level, not the operation level. The state-guard model assumes the operation's *target* is the only race surface. Cross-target races (plugin operations vs. parent-marketplace operations) are not modeled.

**How to avoid:**

- **At commit time, install MUST verify the parent marketplace record still exists.** If absent, classify as "marketplace was removed concurrently" and roll back staged resources. Mirror the existing PI-15 pattern.
- **`marketplace remove` MUST acquire a logical lock that blocks new installs into that marketplace.** Either a separate `<extensionRoot>/locks/marketplace-<name>.lock` file (advisory only -- Node has no portable mandatory locking) or a `removing: true` flag on the marketplace record that install commits check.
- **Add a test that interleaves `marketplace remove` and `install` against the same marketplace, asserts no orphan plugin record, and asserts no leaked resource files.**

**Warning signs:**

- Orphan plugin records discoverable via state validation (records pointing to marketplaces not in `state.marketplaces`)
- Resource files in `resources/skills/` with no corresponding state record
- Tests that mock state-guard rather than running real concurrent operations

**Phase to address:** Concurrency phase (PRD §6.9 ST-7, ST-8). Successor-architecture extension to the V1 race model.

______________________________________________________________________

### Pitfall 7: Live integration test against `anthropics/claude-plugins-official` fails for reasons unrelated to the code

**What goes wrong:** PRD §12 lists the canonical end-to-end test: "anthropics/claude-plugins-official: install + uninstall every supported plugin". This test depends on the upstream marketplace existing, being clonable, having a stable plugin set, and having no plugin that triggers a code path the test author didn't anticipate. It fails in CI when:

- Network is offline or rate-limited (GitHub clone)
- Upstream adds a plugin with a new component class (PRD §11 unsupported components -- should classify as `unavailable`, but if the resolver crashes, the test fails opaquely)
- Upstream renames a plugin between when the test list was hardcoded and when CI ran
- Upstream adopts a `marketplace.json` field the parser doesn't tolerate (NFR-12 says forward-compatible -- but only proves itself against today's upstream)
- A user runs the test with a stale local clone that's behind upstream
- GitHub's clone protocol changes (e.g., the partial-clone default)

**Why it happens:** "Live" integration tests trade reproducibility for realism. They catch a class of bugs unit tests can't, but their failure mode is "did the code break or did the world change?" -- and the answer is often unclear to a CI observer.

**How to avoid:**

- **Pin a specific commit SHA of `anthropics/claude-plugins-official` in test fixtures**, not the floating `main`. Update the pin via a dedicated PR with a changelog of what upstream changed.
- **Fork-and-vendor a snapshot of the upstream marketplace as a test fixture.** Run the live test in two modes: `INTEGRATION_LIVE=1` against floating main (nightly), default against the vendored snapshot (every commit).
- **Classify failure modes in CI output**: network errors, upstream-changed errors, our-code errors. Use exit codes or structured output so a flaky live test doesn't block PRs.
- **Add a smoke test** that verifies upstream's marketplace.json parses with the current parser BEFORE the install loop runs. If parse fails, exit with `UPSTREAM_SCHEMA_DRIFT` and skip the rest with a clear "review upstream changes" message.
- **Run the live test against multiple Node versions (22 LTS, 24, 26)** to catch Node-API drift independent of upstream drift.

**Warning signs:**

- CI history shows the live test flaking weekly with no code changes
- "rerun in 5 min and it passes" -- masks real upstream changes
- Test failures that don't include enough context to determine root cause

**Phase to address:** Testing infrastructure phase. Live integration tests should be designed in alongside the e2e test framework, not bolted on after.

______________________________________________________________________

### Pitfall 8: Discriminated union narrowing relies on a property TypeScript can't prove at runtime

**What goes wrong:** PR-1 mandates `{ installable: true, pluginRoot, ... } | { installable: false, ... }`. NFR-7 says "consumers do not get to read pluginRoot from a non-installable plugin." The pattern only works if every consumer narrows by `installable` (`if (resolved.installable) { ... resolved.pluginRoot ... }`). Common runtime drift modes:

- A consumer destructures: `const { pluginRoot } = resolved` -- TypeScript with `strictNullChecks: true` catches this, but `noUncheckedIndexedAccess` doesn't apply, and a `// @ts-expect-error` from a panicked refactor silently lets it through.
- A `switch (resolved.installable)` without a `default: assertNever(resolved)` -- adding a third variant later (e.g., `installable: 'partial'` for the deferred `--force` flag) silently passes type-check.
- JSON serialization → deserialization loses the discriminant property (e.g., a custom `toJSON` strips boolean-false fields). Re-parse hands you `{}`, and `if (resolved.installable)` evaluates the missing key as falsy by coincidence.
- The discriminant is stored as a string and refactored to a different string ("Available" → "available"). Comparison still type-checks because both are `string`.

**Why it happens:** TypeScript's discriminated unions are a compile-time fiction projected onto runtime objects. They survive in-memory passing but degrade across any boundary that erases types: JSON serialization, `Object.assign`, spread-and-rebuild, `as` casts, library boundaries.

**How to avoid:**

- **Always use `as const` on the discriminant** at the construction site to preserve the literal type.
- **Centralize construction in factory functions** (`installable(...)`, `notInstallable(...)`); never let consumers build the union shape directly.
- **Add `assertNever` (or `satisfies never`, TS 4.9+) at every switch default.** ESLint rule `@typescript-eslint/switch-exhaustiveness-check` enforces this.
- **Schema-validate at boundaries.** Anything coming from JSON.parse (state.json, marketplace.json, plugin.json) MUST run through a runtime validator (Zod, TypeBox, or Valibot) that produces the typed shape. Don't trust `as ResolvedPlugin`.
- **Snapshot test the JSON shape** of each variant so accidental field elision shows up in code review.

**Warning signs:**

- `as` casts on resolver outputs
- Consumers of the resolver that read `pluginRoot` outside an `if (resolved.installable)` block
- Custom serialization that drops false/null/undefined fields
- A growing discriminant without exhaustiveness assertions

**Phase to address:** Plugin compatibility resolver phase (PRD §6.4 PR-1, NFR-7). Add the runtime-validation gate at the same time as the type-level discrimination -- they are two halves of one contract.

______________________________________________________________________

### Pitfall 9: ESM-only ecosystem traps in Node ≥22

**What goes wrong:** Several common patterns silently fail or behave unexpectedly under Node 22 ESM:

- `__dirname` and `__filename` are not defined in ESM. Code that uses them (often copied from older docs or CommonJS examples) throws `ReferenceError` only on the code path that hits the line.
- `require()` is restricted; dynamic CommonJS dependencies must use `createRequire(import.meta.url)` and the CommonJS module must not be ESM-only.
- `import.meta.resolve()` is now stable in Node 22 -- but its behavior differs subtly between Node 20 and 22, and in 22 it returns a string synchronously (used to be a Promise).
- A peer dependency (`@mariozechner/pi-coding-agent`, NFR-11) that's CommonJS-only forces you into interop hell; mixing default and named imports trips named-export detection.
- Top-level `await` works in ESM but not in CommonJS; a refactor that converts an ESM file to CJS for some bundler reason silently breaks it.
- `__proto__` JSON-injection: `JSON.parse('{"__proto__":{"polluted":true}}')` populates the prototype chain in Node ≥22 just like before (no patch); state.json reads must defend.

**Why it happens:** The ESM transition is mostly done but the long tail of CJS dependencies, copy-pasted snippets, and tooling expectations (tsx, ts-node, jest, vitest) still trips developers. Node 22 stabilized features that were experimental in 20, changing return types and behavior.

**How to avoid:**

- **Lock to ESM** (`"type": "module"` in package.json) and refuse CJS escape hatches in code review.
- **Use `node:url` `fileURLToPath(import.meta.url)`** instead of `__filename`. Provide a `paths.ts` helper that exposes `dirnameOf(metaUrl)` and `pathOf(metaUrl)` so consumers don't reinvent.
- **Pin TypeScript `module: "node22"`** (or `nodenext` with target Node 22) to make the type system match the runtime.
- **Validate JSON-parsed objects with a schema library** that strips prototype-pollution keys (Zod, Valibot, TypeBox). Never `Object.assign(target, JSON.parse(input))` directly.
- **Add a Node-version smoke test** in CI matrix: 22 LTS minimum, 24 current, 26 next-LTS-prep. Catch `import.meta` drift before users do.

**Warning signs:**

- `__dirname` or `require(` showing up in source files
- `JSON.parse` with no schema validation immediately following
- "It worked locally but breaks in CI" where local Node and CI Node differ by major version

**Phase to address:** Foundations phase (toolchain + module-resolution baseline). Address before any feature code, as ESM patterns are pervasive.

______________________________________________________________________

### Pitfall 10: "Looks-Done" path safety -- `assertPathInside` checks the resolved path, not the symlink target

**What goes wrong:** PS-1 / NFR-10 require `assertPathInside(parent, child)`. The straightforward implementation is `path.resolve(child).startsWith(path.resolve(parent) + path.sep)`. This passes for `<scopeRoot>/agents/legitimate.md` but ALSO passes for `<scopeRoot>/agents/innocent.md` even if `innocent.md` is a symlink to `/etc/passwd`. A subsequent `fs.writeFile(<scopeRoot>/agents/innocent.md)` follows the symlink and writes to `/etc/passwd`. The path check verified the *path string*, not the *resolved inode*. A malicious plugin (or even an honest mistake by a plugin author who symlinked into a destination) escapes containment.

**Why it happens:** `path.resolve` does not follow symlinks. `fs.realpath` does, but it requires the target to exist (so a check-before-write can't use it for new files). The naive containment check is necessary but not sufficient.

**How to avoid:**

- **Refuse to write to any destination path whose parent directory contains symlinks pointing outside the containment root.** Walk parents with `fs.lstat` and check `isSymbolicLink()`, then `fs.readlink` to verify target containment.
- **For directory creation, use `fs.mkdir(path, { recursive: true })` and verify the created path with `fs.realpath` after creation -- fail loudly if it doesn't equal the intended path.**
- **Refuse to follow symlinks in source plugin trees during copy.** PRD says component paths in `plugin.json` MUST be relative (PS-3) but doesn't address symlinks within those relative paths. `fs.cp({ verbatimSymlinks: true })` plus a post-copy walk that rejects the install if any symlink target escapes plugin root.
- **Test: create a fixture plugin with a symlink at `agents/inner.md → ../../../../etc/passwd`. Install must fail with `PathContainmentError`, not write to /etc.**

**Warning signs:**

- `assertPathInside` implementation that uses only `path.resolve` and `startsWith`
- `fs.cp` calls without `verbatimSymlinks` or symlink filter
- Tests that check string paths but never create real symlink fixtures

**Phase to address:** Path safety phase (PRD §6.10 PS-1 through PS-5). Successor must extend V1's string-level check to inode-level verification.

______________________________________________________________________

### Pitfall 11: MCP server-name collision check (MC-4) misses one of the four slots

**What goes wrong:** MC-4 / RN-5 require collision check across all four pi-mcp-adapter slots: `~/.config/mcp/mcp.json`, `~/.pi/agent/mcp.json`, `<cwd>/.mcp.json`, `<cwd>/.pi/mcp.json`. Easy ways to get this wrong:

- Hardcoding the slot list in two places (collision detector + unstage cleanup); they drift when pi-mcp-adapter adds a fifth slot.
- Reading slots in parallel without ordering -- two concurrent installs each see an empty slot, both stage the same name, second one wins by accident.
- Treating "file missing" identically to "file empty `{}`" -- the collision check skips it, but then a parallel install creates the file and the first commit overwrites with no warning.
- The `_claudeMarketplace` self-marker (MC-5) lets self-replace through, but the marker comparison is by `(plugin, marketplace)` only -- if the user has the same marketplace cloned into both `user` and `project` scope (legitimate), self-replace logic incorrectly matches across scopes.
- `<cwd>` changes mid-process (chdir) and the project-scope slot moves silently.

**Why it happens:** Four-slot scanning is verbose, easy to skip a slot, and easy to over-share between commit and detection paths. The contract (which slots exist, what file shape, what marker semantics) lives entirely in pi-claude-marketplace's source.

**How to avoid:**

- **Centralize the slot list in one constant: `MCP_COLLISION_SLOTS: readonly McpSlot[]`.** All callers iterate this constant. Adding a slot is one change.
- **Lock cwd at command entry** and pass it explicitly through the call chain. Never re-read `process.cwd()` during an operation.
- **Self-replace marker comparison must include scope** -- match `(plugin, marketplace, scope)` not just `(plugin, marketplace)`.
- **Define "slot is occupied" as `file exists AND parses to a JSON object with mcpServers field`.** Empty/missing file is treated as "occupiable, must be created with the entry, atomic write".
- **Test the collision check against a fixture that occupies each of the four slots in turn**, asserting that a name-conflict in any slot blocks stage.

**Warning signs:**

- Two functions that both list "the four slots" -- they will drift
- A `getCwd()` call inside a deeply-nested function rather than a parameter
- pi-mcp-adapter README mentioning a slot not in the collision check

**Phase to address:** MCP servers bridge phase (PRD §5.8 MC-4, §6.5 RN-5). Bake the slot list into a single typed constant before the bridge ships.

______________________________________________________________________

### Pitfall 12: Update phase-3 partial failure leaves "schrodinger's plugin" -- state says new, disk has mix

**What goes wrong:** PUP-6 mandates three-phase update: prepare → state-guard swap → physical replace + soft-dep commit. Phase 3 has multiple sub-steps (3a remove old resources, 3b move staged new resources, 3c commit prepared agents+MCP). State has already been updated to the new version at the end of phase 2. If 3a partially succeeds (some old skill files removed, others not -- EACCES on one), then 3b runs and lays down new files. Now the disk contains: new state.json, all new resources, plus stranded old resource files. A subsequent `list` reads the new state and shows the user "v2 installed", but their actual experience uses both v1 and v2 resources (Pi resources_discover walks the directory).

**Why it happens:** The PRD says PUP-6 emits a recovery hint (`plugin-uninstall + plugin-install`) when phase 3 fails. But the contract treats phase 3 as atomic-enough -- there's no rollback because state is already committed. The recovery hint is the user's responsibility. This is correct in principle but easy to get wrong: the *detection* of partial 3a/3b success is not specified, so a partial failure can complete silently.

**How to avoid:**

- **Phase 3a (remove old resources) MUST aggregate failures into a list and surface it BEFORE phase 3b runs.** A single failed remove → abort with the recovery message; do not continue to lay down new files on top.
- **Make phase 3 idempotent by re-running it** rather than treating it as one-shot. The recovery hint becomes "rerun update" in many cases.
- **Tag every staged resource file with a per-version marker on disk** (e.g., `<resource>.gen-version`) so a startup-time scan can detect "this file's marker doesn't match state's recorded version" and surface it as drift.
- **Add a `validate` subcommand** (could be CLI-only, hidden) that walks state vs. disk and reports orphans. Not in V1 scope but should be planned for the successor.

**Warning signs:**

- The string "rollback partial" never appearing in a phase-3 failure (because phase 3 explicitly doesn't roll back state)
- User reports of "I updated and now I have two versions of the same skill"
- Tests that only assert state changes, not that the disk matches state

**Phase to address:** Atomic staging + plugin update phase (PRD §5.2.3 PUP-6, PUP-7, §6.11 AS-3, AS-4). Define the partial-3a behavior explicitly in the successor.

______________________________________________________________________

### Pitfall 13: Hash-versioned plugins (PI-7) silently re-install on irrelevant changes

**What goes wrong:** PI-7 specifies SHA-256 over a recursive directory walk, sorted by name, hashing entry name + (file contents | recursive descent). The hash explicitly excludes mtime, permissions, ownership, symlink targets. But `plugin update` compares "manifest version" against "recorded version" -- for a hash-versioned plugin (no manifest version, no entry version), the manifest version IS a freshly-computed hash. If the plugin has any non-deterministic content (e.g., a generated CHANGELOG with timestamps, an .DS_Store file, an editor swap file), the hash changes between every fetch, and `update` re-installs every time -- invisible to the user as "version churn" with no actual content change.

Conversely, if the hash algorithm includes something the user expects to be content (e.g., the user adds a file via a hook), the hash should change but doesn't because the file was filtered.

**Why it happens:** "Recursive walk hash" is conceptually simple but has many edge cases: hidden files (.DS_Store, .git, Thumbs.db), file types other than regular files (sockets, FIFOs, devices -- rare but possible), encoding (file content read as buffer vs. string), platform-specific filename normalization (HFS+ NFD vs. APFS NFC).

**How to avoid:**

- **Filter hidden files explicitly.** Document the filter list (`.DS_Store`, `.git`, `Thumbs.db`, `desktop.ini`, swap files). Anything else is content.
- **Normalize filenames to NFC** before sorting and hashing. macOS HFS+ used NFD, APFS uses NFC; cross-platform clones can produce different bytes for the same logical name.
- **Read files as buffers, not strings.** A UTF-8 decode + re-encode introduces ambiguity around invalid sequences.
- **Refuse to hash anything other than regular files and directories.** A symlink, FIFO, socket, or device file in a plugin is a malformed plugin -- surface as `unavailable`.
- **Snapshot test the hash algorithm against a known fixture.** The hash of a fixed directory MUST be a fixed string. If it changes, that's a contract break (the PRD already names this -- see PI-7 commentary on 12-char truncation).

**Warning signs:**

- User reports "update keeps saying my plugin updated but nothing changed"
- Test for the hash function uses an in-memory fixture that doesn't include real platform quirks
- The filter list isn't documented in source

**Phase to address:** Plugin install + version handling phase (PRD §5.2.1 PI-7). The 12-char truncation is the tip of an iceberg; the algorithm spec needs a robust test fixture.

______________________________________________________________________

### Pitfall 14: GitHub clone divergence recovery requires user action, but state still references old SHA

**What goes wrong:** Per journey 7.3, `marketplace update` against a non-fast-forward divergence fails with the git error and "state is untouched". The recovery is `marketplace remove` + `marketplace add` + reinstall plugins. But if the user merely retries `marketplace update` (a natural reflex), the same git error repeats. Their installed plugin records still point to `marketplaceRoot` (the local clone path), which is now stale relative to the manifest the user expected to update to. List output shows `(installed, upgradable)` based on the cached (pre-divergence) manifest, but `update` will fail again at the syncClone step. There's no "force-reset clone to origin" recovery short of full remove-and-re-add.

**Why it happens:** The PRD doesn't define a "rebuild clone, preserve state" recovery path. `marketplace remove` cascades resource cleanup, which triggers the disruptive RH-5 reload-hint flow even when the user only wanted to refresh git state.

**How to avoid:**

- **Add a `marketplace reclone <name>` (or `marketplace repair`) subcommand** that does: clone fresh into a new staging dir, atomic-rename over the old `marketplaceRoot`, leave state.json untouched. This is a successor-architecture addition not in V1 scope, but should be planned.
- **At minimum, the failed-update error message MUST include explicit recovery steps** ("Run `<exact command>` to reset the clone") rather than just surfacing the raw git error.
- **Detect the divergence class** (non-FF vs. permission denied vs. network) and emit class-specific guidance. The current "git ... fatal: ..." passthrough is too opaque.
- **Test: simulate a divergence via fixture (rewrite history in a local-clone fixture origin) and assert the error message names a concrete next step.**

**Warning signs:**

- Bug reports of "I have to nuke the marketplace and re-add"
- Users running `git pull --rebase` manually inside the clone (and breaking the marker invariants)
- Reload-hints firing when the user just wanted to refresh manifest pointers

**Phase to address:** Marketplace lifecycle phase (PRD §5.1.4). Successor enhancement; V1 ships the workaround documented in journey 7.3.

______________________________________________________________________

### Pitfall 15: `ctx.ui.notify` severity discipline erodes via "I'll just add a console.log for debugging"

**What goes wrong:** ES-1 / IL-2 mandate single output channel through `ctx.ui.notify`. IL-3 sanctions exactly one `console.warn` (the load-time migration save failure). But debugging code, copied snippets from other extensions, or "temporary" instrumentation introduces `console.log`/`console.error`/`process.stdout.write` calls that survive into production. The output channel contract erodes silently -- tests don't catch it (they assert what notify *receives*, not what stdout *emits*), users see double-printed messages or messages out of order.

**Why it happens:** Single-channel discipline is a code-review concern with no automated enforcement. ESLint has `no-console` but it's commonly disabled in test files (which leak into shared utilities), and `process.stdout.write` is harder to lint without custom rules.

**How to avoid:**

- **ESLint rule: `no-console: error` in source code (not tests).** Allow `console.warn` only in the single sanctioned migration file with an explicit comment.
- **Custom ESLint rule banning `process.stdout.write`, `process.stderr.write` in command and bridge directories.** Whitelist only `src/cli/notify.ts` (or wherever the channel lives).
- **Test infrastructure asserts NO writes to stdout/stderr during a command run.** Use `vitest --reporter=verbose` with stdout capture, fail if anything other than the test runner itself wrote.
- **Pre-commit hook greps for `console.` outside the sanctioned files.** Cheap and high-signal.

**Warning signs:**

- Any PR adding `console.` calls
- "Just for debugging, I'll remove it before merge" comments in PRs
- Test output with unexpected lines

**Phase to address:** Foundations phase (toolchain). ESLint custom rules + pre-commit hooks should land before any feature code.

______________________________________________________________________

## Technical Debt Patterns

| Shortcut                                                           | Immediate Benefit                                | Long-term Cost                                                                | When Acceptable                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Skip `fsync` after rename for state.json                           | Faster commit (~5-50ms saved per op)             | Crash-window data loss; "where did my plugin go?" support load                | Never for state.json; acceptable for staging tmp files             |
| Hardcode tool names for soft-dep probing (RH-3/RH-4)               | Easier to write; avoids schema design            | Probe drift on companion-extension renames; warning false positives/negatives | V1 only -- successor must add capability-based probing             |
| Use `as ResolvedPlugin` instead of runtime validation              | Removes Zod/TypeBox dep; less schema duplication | Type lies at runtime; corrupted state.json crashes deep in business logic     | Only for in-memory transformations; never at JSON boundaries       |
| One `marketplace.json` parser with no version field check (NFR-12) | Forward-compatible against evolving upstream     | Cannot detect known-breaking-change schema versions when they happen          | Acceptable as documented; revisit if upstream adds `schemaVersion` |
| Live integration test against floating `main` of upstream          | Catches real upstream changes early              | Flaky CI; failure attribution unclear                                         | Nightly only; PR CI uses pinned commit SHA                         |
| `path.resolve` + `startsWith` for containment check                | Simple, fast, no FS calls                        | Symlink bypass to /etc/passwd                                                 | Only after pairing with symlink-walk verification                  |
| Single-process testing for concurrency invariants                  | Fast, deterministic                              | Misses real-process race windows; PI-15 untested at OS level                  | Unit-test level; complement with multi-process integration tests   |
| English-only messages (IL-1)                                       | No catalog infrastructure to build               | Future i18n requires touching every notify call site                          | V1 only -- successor should plan a message-catalog layer (IL-5)    |
| Skip `cwd` lock at command entry                                   | Less plumbing                                    | Project-scope operations target wrong directory if process chdirs             | Never -- capture cwd at entry, pass explicitly                     |
| Catch `EXDEV` and fall back to copy+unlink                         | Operation succeeds across mounts                 | Loses atomic guarantee silently; corrupts on crash mid-copy                   | Never without explicit user-visible warning                        |

## Integration Gotchas

| Integration                                   | Common Mistake                                                                                   | Correct Approach                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pi-subagents`                                | Probing by tool name only; no version assertion                                                  | Capability-based probe with documented contract version; fall back to name probe with deprecation warning                                            |
| `pi-mcp-adapter`                              | Treating "tool name `mcp`" and "sourceInfo `pi-mcp-adapter`" as interchangeable                  | Both must be checked (RH-4 mandates OR); enforce via separate test for each detection path                                                           |
| `@mariozechner/pi-coding-agent` (peer dep)    | Pinning to `*` lets API surface drift break installs                                             | Pin a min version once successor stabilizes (NFR-11); add a runtime feature-detection probe at extension load                                        |
| GitHub clone                                  | Assuming `git clone` is the only way (vs. tarball download); not handling shallow-clone defaults | Wrap git invocation; explicitly use `--no-shallow` or `--depth=full` if metadata operations needed; test against `--filter=blob:none` partial clones |
| GitHub URL parsing                            | Accepting `git@github.com:owner/repo` (SSH) thinking it's harmless                               | SP-3 already rejects; ensure error message clearly says "use https"                                                                                  |
| `anthropics/claude-plugins-official` upstream | Hardcoding a list of expected plugins                                                            | Iterate from manifest; assert install/uninstall succeeds for each rather than hardcoded names                                                        |
| Pi `ctx.ui.notify` API                        | Calling with severity-as-string and message-as-string in wrong order                             | Wrap in a typed `notify({ severity, message })` helper; ban direct `ctx.ui.notify` calls outside the wrapper                                         |
| Pi `pi.getAllTools()`                         | Caching the result at extension load                                                             | Re-query on each probe; tools can load mid-session via `/reload`                                                                                     |
| Local path source                             | Resolving `~` via `os.homedir()` only at parse time and caching                                  | Store unchanged (SP-7); expand on every access via `expandTildePath`                                                                                 |
| `fs.cp` (Node ≥16 stable)                     | Default symlink behavior copies as symlinks; `verbatimSymlinks: false` (default) follows them    | Always pass `{ recursive: true, verbatimSymlinks: true, force: false }`; verify result with realpath                                                 |

## Performance Traps

| Trap                                                                         | Symptoms                                                   | Prevention                                                                                          | When It Breaks                                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Re-reading every `marketplace.json` on every `list` invocation               | Tab completion lag of 200-500ms with 5+ marketplaces       | NFR-8 backlog: cache with mtime invalidation                                                        | At ≥3 marketplaces with autoupdate weekly; tab completion noticeable >5 marketplaces |
| Sequential git clone on `marketplace update` (bare, all marketplaces)        | Multi-second wait for users with many marketplaces         | Parallelize with `Promise.all` capped at concurrency 4; report progress per-marketplace             | At ≥4 marketplaces; especially painful on slow networks                              |
| Hashing entire plugin directory on every `update` for hash-versioned plugins | CPU spikes proportional to plugin size                     | Cache hash with a "directory mtime + size" sentinel; recompute on sentinel change                   | Plugin >5MB, slower disks (HDD), or many hash-versioned plugins in cascade           |
| `withStateGuard` re-reading state.json on every guarded op                   | I/O storm during cascade update with 10+ plugins           | Single-load per cascade with internal generation counter (still re-checks at commit)                | At ≥10 plugins per marketplace, or with project-scope state on networked FS          |
| Building completion lists by full-walk on every keystroke                    | Tab completion lag scaling with marketplace × plugin count | Pre-compute completion index on extension load + on state mutations only                            | At total plugins ≥50                                                                 |
| Loading ALL agent index entries on every uninstall                           | Slow uninstall when index grows                            | Partition index by `(marketplace, plugin)` (AG-3 already does this); load only the partition needed | At ≥100 total agents across all installs                                             |
| Walking node_modules during plugin hash computation                          | Hash computation absurdly slow for plugins that ship deps  | Hash filter MUST exclude node_modules; document in PI-7 spec                                        | First plugin that ships its own node_modules; rare but catastrophic                  |

## Security Mistakes

| Mistake                                                                 | Risk                                                                                                           | Prevention                                                                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Treating plugin source path as trusted (no symlink check)               | Plugin can write outside its containment via symlink target                                                    | Walk parents with lstat; refuse if any symlink target escapes plugin root or scope root                                                          |
| Accepting `${CLAUDE_PLUGIN_ROOT}` substitution without escaping         | Plugin author embeds shell metacharacters in plugin path; substituted into agent body that gets shell-executed | Substitute as opaque string only; never auto-execute; document that plugin authors must not rely on shell-eval semantics                         |
| `JSON.parse(state.json)` with no schema validation                      | `__proto__` injection from corrupted state pollutes prototype chain                                            | Validate every JSON.parse output through Zod/TypeBox/Valibot schema; reject `__proto__`/`constructor`/`prototype` keys explicitly                |
| Logging full plugin source paths to user output                         | Reveals home directory structure (NFR-9 names this risk)                                                       | Truncate paths to `~/...` form for user-facing output; full paths only in error.cause chain                                                      |
| Running `git clone <user-supplied-source>` without source validation    | RCE via crafted git URL with submodule pointing to remote ref                                                  | SP-1 / SP-3 already restrict to <https://github.com> form; add `--no-submodules` to clone invocation; validate hostname                          |
| Trusting `marketplace.json` `name` field for filesystem path derivation | Marketplace author embeds `..` or `/` in name; path traversal                                                  | RN-2 `assertSafeName` already required for marketplace + plugin + skill + command + agent + MCP names; ensure runtime check, not just type check |
| Foreign-content guard using only basename check                         | Attacker creates a file named `claude-marketplace-attack.md` with no marker; uninstall removes it              | AG-5 mandates BOTH basename AND marker check; test with negative cases                                                                           |
| State.json including secrets accidentally (e.g., GitHub token)          | Token leaks via shared state.json or backup tools                                                              | State.json schema validation rejects unknown fields; never store auth tokens (use git's credential helper instead)                               |
| `mcp.json` merge accepting arbitrary fields from plugin                 | Plugin injects fields into adjacent MCP server entries                                                         | Strict schema for MCP server entries; only known fields (command, args, env) plus `_claudeMarketplace` marker                                    |
| Rollback writes to user-owned files                                     | Rollback restores an old version that overwrites a user-modified file                                          | AS-7 / PU-7 already mandate foreign-content protection; ensure rollback paths use the same guard                                                 |

## UX Pitfalls

| Pitfall                                                                                | User Impact                                                                                                           | Better Approach                                                                                                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Reload hint on EVERY successful op (even no-op)                                        | Users habituate to ignoring it; miss real reload needs                                                                | RH-1 already mandates emit-only-on-change; enforce via test asserting no hint when no resource changed                                    |
| Soft-dep warning suppressed when probe falsely returns true                            | User installs plugin with agents but doesn't see "pi-subagents not loaded" warning; confused that agents don't appear | Capability-based probe + explicit "verified" flag in probe result; if capability is missing, surface warning even on positive name probe  |
| Error messages that leak internal phase names verbatim                                 | `(rollback partial: [stagePluginAgents] EACCES …)` is meaningful to maintainers, not users                            | Translate phase names to user-facing terms ("agent files", "MCP entries"); keep internal name only in Error.cause for debugging           |
| `Run /reload to load "n1", "n2", "n3", ...` listing 50 names                           | Wall-of-text in terminal                                                                                              | Truncate at 10 with "... and N more"; full list on `--verbose` flag (deferred to backlog if needed)                                       |
| `Plugin not installable: <notes>` with cryptic notes                                   | Notes are designed for resolver internals; users can't act                                                            | Each note must include a "what to do" hint; "absolute path in source.path → ask plugin author to use relative paths"                      |
| Asking users to manually nuke and re-add a marketplace on git divergence (journey 7.3) | High-friction recovery; users may abandon the marketplace                                                             | Add `marketplace reclone` subcommand for the common case; surface it in the divergence error message                                      |
| Tab completion silently empty for one marketplace's plugins                            | User assumes the marketplace is empty; doesn't realize manifest is corrupt                                            | TC-8 already mandates per-marketplace soft-fail to empty set, BUT also surface a notice on the next non-completion command (e.g., `list`) |
| Long-running `marketplace update` with no progress indication                          | User thinks Pi is hung                                                                                                | Per-marketplace progress lines via `ctx.ui.notify` at default severity; "Refreshing mp1...", "Refreshing mp2..."                          |
| Mixed-scope `list` output with subtle scope tags users miss                            | User installs into wrong scope; subsequent `update` doesn't match expectations                                        | PL-2 nested tree by scope; ensure scope label is visually prominent (color/bold via Pi's notify rendering, or `[user]` prefix)            |
| Errors that don't include the operation context                                        | "git failed" with no marketplace name                                                                                 | Every error must lead with `<operation> <target>: <cause>` (e.g., "marketplace update mp: git fetch failed: (git output)")                |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces. Verify each during phase execution.

- [ ] **Atomic rename:** Often missing parent-directory `fsync` -- verify by power-cutting a VM mid-rename and checking state.json on reboot
- [ ] **Cross-device staging:** Often hardcodes `/tmp` or `os.tmpdir()` -- verify by mounting `/tmp` as a separate filesystem and re-running tests
- [ ] **Soft-dep probe:** Often only tests positive case (companion loaded) -- verify with companion loaded, unloaded, and renamed-tool scenarios
- [ ] **Path containment:** Often only checks resolved path string -- verify with symlink fixture pointing outside scope
- [ ] **Foreign-content guard:** Often only checks basename -- verify by writing a marker-less file with the right basename and asserting refusal
- [ ] **State migration:** Often only tests forward (legacy → current) -- verify forward AND that current rejects future-version state
- [ ] **Concurrent state-guard:** Often only tests sequential rapid calls in one process -- verify with two real processes via integration test
- [ ] **MCP collision check:** Often skips one of the four slots -- verify by occupying each slot in turn and asserting blocked
- [ ] **Hash algorithm:** Often doesn't filter `.DS_Store` etc. -- verify hash stability against a directory with hidden files added/removed
- [ ] **Reload hint suppression:** Often emits on every success -- verify no-op operations (e.g., adding empty marketplace) do NOT emit hint
- [ ] **EXDEV handling:** Often falls back to copy+unlink silently -- verify it raises a clear error naming both filesystems
- [ ] **`ctx.ui.notify` discipline:** Often `console.log`s creep in -- verify via test asserting zero stdout/stderr writes during command runs
- [ ] **Marker string stability:** Often refactored without snapshot test -- verify ES-5 markers match PRD verbatim via snapshot
- [ ] **Tab completion soft-fail:** Often per-marketplace failures blank the whole list -- verify completion works when one marketplace has corrupt manifest
- [ ] **Rollback completeness:** Often the rollback path itself isn't covered -- verify that aborting AT EVERY phase boundary leaves no orphaned files
- [ ] **Live integration test attribution:** Often failures don't say if upstream changed or our code broke -- verify CI output classifies failure type
- [ ] **Cwd-lock at command entry:** Often `process.cwd()` is read deep in call stack -- verify by chdir mid-operation and asserting target paths unchanged
- [ ] **Schema-validate at JSON boundaries:** Often `as` casts the parse result -- verify Zod/TypeBox runs on every state.json / marketplace.json / plugin.json read

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall                                 | Recovery Cost                         | Recovery Steps                                                                                                                              |
| --------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| EXDEV breaks atomic rename (Pitfall 1)  | LOW                                   | Move stagingDir to same FS as destination; rerun command; surface clear "tmp filesystem misconfigured" message                              |
| State.json crash-rollback (Pitfall 2)   | MEDIUM                                | On load, detect resource-vs-state mismatch; offer "reconcile" command that either re-records found resources or removes them                |
| Soft-dep probe drift (Pitfall 3)        | LOW                                   | Patch release with updated probe; meanwhile users see false warning but functionality works                                                 |
| Marker string drift (Pitfall 4)         | MEDIUM                                | Ship migration that scans agents-index, rewrites marker on read, surfaces "migrated N agents" warning                                       |
| State schema downgrade (Pitfall 5)      | HIGH                                  | Refuse to save; tell user to upgrade pi-claude-marketplace; if user has already saved a downgrade, manual `state.json` recovery from backup |
| Cross-target race (Pitfall 6)           | LOW                                   | Detect orphan plugin records on load; offer cleanup command; until then, surface as warning in `list`                                       |
| Live test flake (Pitfall 7)             | LOW                                   | Pin upstream SHA; rerun against pinned to confirm it's an upstream change vs. our code                                                      |
| Discriminated union drift (Pitfall 8)   | MEDIUM                                | Add runtime schema validation; cause may be already-corrupted state -- manual repair                                                        |
| ESM trap (Pitfall 9)                    | LOW                                   | Patch source to use ESM-correct API; add ESLint rule banning the broken pattern                                                             |
| Symlink containment escape (Pitfall 10) | HIGH                                  | Audit any user-reported writes to unexpected paths; patch immediately as security advisory                                                  |
| MCP slot miss (Pitfall 11)              | MEDIUM                                | Add slot to constant; ship patch; users with stale collisions need manual mcp.json edit                                                     |
| Update phase-3 partial (Pitfall 12)     | MEDIUM                                | Run uninstall + install per the recovery hint; future: validate command auto-detects                                                        |
| Hash drift (Pitfall 13)                 | LOW                                   | Add filter or normalization; on next update, hashes converge; one extra "update with no changes" cycle                                      |
| Git divergence (Pitfall 14)             | LOW (with reclone) / MEDIUM (without) | `marketplace reclone` (successor) OR `marketplace remove` + `marketplace add` + reinstall (V1)                                              |
| Notify discipline drift (Pitfall 15)    | LOW                                   | Strip the offending console.log; add ESLint rule to prevent recurrence                                                                      |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. Phase names are placeholders; actual phase names depend on roadmap structure (the orchestrator's roadmap step will name them).

| Pitfall                      | Prevention Phase                                                          | Verification                                                                       |
| ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. EXDEV cross-device        | Foundations / Atomic ops (PRD §6.11 AS-1)                                 | Test: mount tmpDir on different FS, assert refusal                                 |
| 2. fsync durability          | State persistence / Atomic ops (PRD §6.9 ST-1, §6.11 AS-1)                | Test: simulate crash via SIGKILL, verify state.json consistent                     |
| 3. Soft-dep probe drift      | Soft-dep probing (PRD §6.8 RH-3/RH-4)                                     | Test: probe with renamed companion tool, assert handled gracefully                 |
| 4. Marker string drift       | Agents bridge / Error surfaces (PRD §5.7 AG-5, §6.12 ES-5)                | Snapshot test against PRD verbatim text                                            |
| 5. State schema mid-flight   | State persistence (PRD §6.9 ST-4, ST-7)                                   | Test: older binary reads newer state, asserts refuse-with-guidance                 |
| 6. Cross-target race         | Concurrency (PRD §6.9 ST-7, ST-8)                                         | Test: interleave `marketplace remove` and `install` via two real processes         |
| 7. Live test fragility       | Testing infrastructure (cross-cutting)                                    | CI matrix: pinned-SHA on PR, floating-main nightly                                 |
| 8. Discriminated union drift | Plugin compatibility resolver (PRD §6.4 PR-1, NFR-7)                      | ESLint exhaustiveness rule + Zod validation at parse boundaries                    |
| 9. ESM traps                 | Foundations (toolchain)                                                   | CI matrix: Node 22, 24, 26; lint rule banning `__dirname`                          |
| 10. Symlink containment      | Path safety (PRD §6.10 PS-1)                                              | Test: install plugin with symlink fixture pointing to /etc, assert refusal         |
| 11. MCP slot miss            | MCP servers bridge (PRD §5.8 MC-4, §6.5 RN-5)                             | Test: occupy each of four slots, assert collision blocks stage                     |
| 12. Update phase-3 partial   | Plugin update / Atomic ops (PRD §5.2.3 PUP-6, §6.11 AS-3)                 | Test: inject EACCES at phase 3a, assert no phase 3b runs, recovery message correct |
| 13. Hash drift               | Plugin install (PRD §5.2.1 PI-7)                                          | Snapshot test: known fixture → known hash, stable across platforms                 |
| 14. Git divergence recovery  | Marketplace lifecycle (PRD §5.1.4) -- successor enhancement               | Test: rewrite-history fixture, assert error includes recovery command              |
| 15. Notify discipline        | Foundations (toolchain -- ESLint rules) + Error surfaces (PRD §6.12 ES-1) | CI: assert zero stdout/stderr writes during command tests                          |

## Sources

- \[PRD: pi-claude-marketplace v1.0\](file:///Users/acolomba/src/pi-claude-marketplace/docs/prd/pi-claude-marketplace-prd.md) -- V1 specification, §6.8-§6.13 horizontal pitfalls and §7 user journeys directly inform Pitfalls 3-15
- \[Project context: PROJECT.md\](file:///Users/acolomba/src/pi-claude-marketplace/.planning/PROJECT.md) -- Constraints, decisions, and successor-architecture scope
- [npm/write-file-atomic Issue #64: Rename atomicity is not enough](https://github.com/npm/write-file-atomic/issues/64) -- Pitfall 2 (atomicity vs. durability)
- [Node.js Issue #19077: fs.rename() won't move files between different disks](https://github.com/nodejs/node/issues/19077) -- Pitfall 1 (EXDEV)
- [anthropics/claude-code Issue #40351: APFS firmlink workspace failure](https://github.com/anthropics/claude-code/issues/40351) -- Pitfall 1 (real-world APFS rename failure mode)
- [LWN: A way to do atomic writes](https://lwn.net/Articles/789600/) -- Pitfall 2 (Linux fsync semantics)
- [xavier roche: Everything You Always Wanted To Know About fsync](https://blog.httrack.com/blog/2013/11/15/everything-you-always-wanted-to-know-about-fsync/) -- Pitfall 2 (fsync deep dive, parent-dir requirement)
- [Microsoft/TypeScript Issue #17448: Exhaustiveness check for discriminated unions in nested switch-case](https://github.com/Microsoft/TypeScript/issues/17448) -- Pitfall 8 (discriminated union edge case)
- [TypeScript: satisfies never for exhaustiveness](https://dev.to/cefn/typescript-satisfies-never-exhaustiveness-checking-in-typescript-49-58fh) -- Pitfall 8 (TS 4.9+ pattern)
- [Node.js Documentation: fs.cp options (recursive, verbatimSymlinks, mode)](https://nodejs.org/api/fs.html) -- Pitfall 10 (symlink handling defaults)
- [Node.js Documentation: child_process signal handling](https://nodejs.org/api/child_process.html) -- Pitfall 14 (git clone signal cleanup, also relevant to Pitfall 1 staging cleanup)
- V1 source code at branch `features/initial` -- empirical pitfall basis (per PROJECT.md context)

______________________________________________________________________

*Pitfalls research for: pi-claude-marketplace successor architecture* *Researched: 2026-05-09*
