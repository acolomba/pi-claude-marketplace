# Stack Research

**Domain:** Declarative, version-controllable config files (desired-state) for a Pi extension; load-time reconciliation + command write-back
**Researched:** 2026-06-09
**Confidence:** HIGH

## Executive Verdict

**This milestone needs ZERO new runtime dependencies.** Every capability the
declarative config files require -- atomic writes for hand-edited + machine-written
JSON, schema validation, cross-process write safety, scoped file reads, migration
from existing state -- is already covered by libraries the project depends on and
uses today (`write-file-atomic@^8`, `typebox@^1.1.38`, `proper-lockfile@^4`,
`node:fs/promises`, `node:test`).

The only stack *decisions* to make are (1) reuse the existing `atomicWriteJson`
seam vs. add a thin variant, (2) define new TypeBox schemas alongside `STATE_SCHEMA`,
and (3) explicitly reject the temptation to add a JSONC / comment-preserving JSON
library. There is no new install command, no file watcher, and no second atomic-write
mechanism.

## Recommended Stack

### Core Technologies (all ALREADY PRESENT -- carry forward)

| Technology | Version | Purpose for this milestone | Why Recommended |
|------------|---------|----------------------------|-----------------|
| **write-file-atomic** | `^8.0.0` (current `8.0.0`, already a direct dep) | Atomic write of `claude-plugins.json` and `claude-plugins.local.json` (tmp + fsync + rename, internal concurrent-write queue). | The config file is *both* hand-edited and machine-written. `write-file-atomic` is exactly the right tool: a power-loss or crash mid-write-back can never leave a half-written or zero-byte config that the next load fails to parse (NFR-1). It is already the project's only sanctioned JSON-write path (`shared/atomic-json.ts`). **Reuse, do not parallel-add.** |
| **typebox** | `^1.1.38` (current `1.2.6`; peer dep `*`, dev-pin `^1.1.38`) | Runtime schema + `Compile`d JIT validator for the new config-file shape (marketplaces: name/source/autoupdate; plugins: plugin@marketplace, enabled) and the local-override shape. | The project's established validation pattern is `Type.Object(...)` + `Compile(...)` + `.Check()` / `.Errors()` (see `persistence/state-io.ts`). The config file is a hand-edited contract, so a JIT validator that produces a precise first-error path (`firstValidationErrorDetail`) is the difference between "your config is wrong at `/plugins/3/enabled`" and a silent reconcile that does the wrong thing. **Same pattern, new schema constant.** |
| **proper-lockfile** | `^4.1.2` (current `4.1.2`, already a direct dep) | Cross-process exclusivity for write-back, via the existing `withStateGuard` / `withLockedStateTransaction` seam. | Write-back mutates the config file *and* internal state.json; both must move under one lock so two Pi processes (or a CLI + a reload) cannot interleave. The existing per-scope `.state-lock` already serializes state mutation -- bring the config write-back inside the *same* lock scope so config + state stay consistent. **No new lock file, no new lock library.** |
| **node:fs/promises** | built-in (Node >= 20.19.0) | `readFile` of the two config files at load; `mkdir -p` of the scope root before first write; ENOENT-as-default-state branch (the migration trigger). | The load path mirrors `loadState`: `readFile` → `JSON.parse` → migrate/normalize → validate. ENOENT on `claude-plugins.json` is the migration signal (generate from state.json), exactly as ENOENT on state.json yields `DEFAULT_STATE` today. **Built-in; no dep.** |
| **node:test + memfs** | built-in / `memfs@^4.57.2` (dev, already present) | Unit tests for load/merge/reconcile/write-back without touching the real FS. | `memfs` is already a dev dep used across the suite. Reconciliation (declared-vs-installed diffing) and the base/local merge are pure-ish logic best tested in-memory; atomic-write + lock interactions get a real-FS integration test as the suite already does. **Carry forward.** |

### Supporting Libraries

None. No supporting library is added for this milestone.

The base/local **merge** (entry-level override) is plain object/array reduction over
two validated POJOs -- it does **not** warrant a deep-merge library (`lodash.merge`,
`deepmerge`). The override semantics are domain-specific (entry-level, last-writer-wins
per `plugin@marketplace` key), so a generic recursive merge would be *wrong*, not just
heavyweight. Write the merge as explicit domain code next to the schemas.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| (existing) eslint `^10`, prettier `^3.8`, tsc `^6`, `node --test` | Unchanged `npm run check` gate. | The new files plug into the existing typecheck/lint/format/test pipeline. The single sanctioned `console.warn` exception in `persistence/migrate.ts` is the model for any best-effort config-generation persist failure -- reuse that eslint per-file override pattern only if a non-`notify` warn site is genuinely needed; prefer routing through `ctx.ui.notify` (IL-2). |

## Installation

```bash
# Nothing to install. All required libraries are already in package.json:
#   dependencies:    write-file-atomic@^8.0.0, proper-lockfile@^4.1.2
#   peer/dev:        typebox (peer "*", dev "^1.1.38")
#   built-ins:       node:fs/promises, node:path, node:test
#   dev (tests):     memfs@^4.57.2
```

If anything is touched in `package.json`, it is at most a routine `typebox` dev-pin
bump (`^1.1.38` → `^1.2.6`, same major, no API change) and is **optional** -- not
required by this milestone.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Reuse `atomicWriteJson` (write-file-atomic) | Hand-rolled `writeFile(tmp)` + `rename` | Only if the config write needs behavior the lib lacks (it does not). The lib already fsyncs + serializes concurrent writes; rolling your own re-introduces the EXDEV/half-write bugs NFR-1 forbids. |
| One TypeBox schema per file shape | Reuse `STATE_SCHEMA` for the config | Do NOT reuse. The config file is a *Pi-native desired-state* shape (locked decision: NOT Claude's `settings.json`, NOT state.json's machine-bookkeeping shape). It has `enabled` flags and lacks materialized-artefact records. A distinct `CONFIG_SCHEMA` keeps the desired-state/bookkeeping split honest. |
| Explicit domain merge for base+local | `deepmerge` / `lodash.merge` | Never here. Override is entry-level (per `plugin@marketplace` / per marketplace name), not arbitrary deep-merge; a recursive merge would silently merge arrays/objects the spec says should be replaced. |
| Validate-on-load, reconcile-on-load | `chokidar` / `fs.watch` live file watching | Never here. The locked decision is reconcile *at extension load only* (Pi startup + reload). A watcher adds a long-lived handle, debounce complexity, and a second reconcile trigger that the design explicitly excludes. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`comment-json` (`5.0.0`)** | Tempting for "preserve user comments in the hand-edited config." But: it pulls in `esprima` (a full JS parser) as a runtime dep; its CST round-trip is fragile across the machine-write/hand-edit boundary (a write-back re-serializes and can drop/relocate comments anyway); and it becomes a *second* JSON I/O path competing with `atomicWriteJson`. The desired-state model means the file is regularly rewritten by commands -- comment preservation is a losing battle by design. | Plain `JSON.parse` on load + `JSON.stringify(value, null, 2) + "\n"` through `atomicWriteJson` on write. If human annotation is wanted, document a top-of-file convention or a dedicated string field in the schema, not free-floating comments. |
| **`jsonc-parser` (`3.3.1`)** | Same category: enables comments/trailing commas in the config. But the file is machine-rewritten on every mutating command, so any JSONC niceties a user adds are erased on the next write-back. Accepting JSONC on *read* while emitting strict JSON on *write* creates a confusing asymmetry (your comment vanished after `install`). | Strict JSON both directions. The file is a desired-state record, not a tunable rc-file. |
| **A second atomic-write helper / direct `write-file-atomic` import in new code** | Bypasses the single sanctioned `shared/atomic-json.ts` seam, fragmenting the NFR-1 guarantee and the mkdir-parent behavior. | Call `atomicWriteJson(configPath, value)`. If a config-specific wrapper is wanted for symmetry with `saveState`, make it a thin `saveConfig` that *delegates* to `atomicWriteJson` (the way `saveState` does), not a new mechanism. |
| **`fs.watch` / `chokidar` / any file watcher** | Reconciliation is load-time-only by locked decision; a watcher is out of scope and adds lifecycle/handle-leak surface. | Reconcile inside the existing `session_start` / load event handler. |
| **A new lock file for the config** | Two locks (config-lock + state-lock) can deadlock or interleave config and state inconsistently. | The existing per-scope `.state-lock` via `withStateGuard`; write config + state under one lock. |
| **`deepmerge` / `lodash.merge` for base+local override** | Generic deep-merge contradicts the entry-level, replace-not-merge override semantics. | Explicit domain merge function over two validated POJOs. |
| **`semver` for the `enabled`/version-pin logic** | The disable/enable flow keeps an existing resolved version pin verbatim (re-materialize from cache, no network); it is exact-string carry-forward, not version-range math. (Mirrors the existing `hash-<12hex>` exact-equality decision.) | Carry the stored version string through unchanged. |
| **`yaml@^2.9.0` for the config files** | It is in devDependencies but has **zero import sites in extension source** (confirmed by grep). The config files are JSON by locked decision. Do not reach for YAML here, and do not let this milestone's work depend on `yaml`. | JSON via the existing JSON path. (Separately: `yaml` looks like a candidate for dependency pruning, but that is out of scope for this milestone.) |

## Stack Patterns by Variant

**Load path (mirror `loadState`):**
- `readFile(claude-plugins.json)` → on ENOENT, **migrate**: generate config from `state.json` (locked decision: nothing uninstalled), write once via `atomicWriteJson`, fire-and-forget persist on the `loadState`/`persistMigratedState` model.
- `readFile(claude-plugins.local.json)` → ENOENT is the *normal* case (no override); treat as empty override, never an error.
- `JSON.parse` → `CONFIG_VALIDATOR.Check()` → precise first-error via the existing `firstValidationErrorDetail` pattern. A malformed hand-edited config should fail *loud and specific*, then soft-degrade (do not block Pi load on a bad config -- surface and continue, consistent with "network attempts soft-fail, never block load").

**Write-back path (mirror `saveState`):**
- Mutating command computes new desired state → assert against `CONFIG_VALIDATOR` (`saveState`'s self-check pattern: a caller bug surfaces here, not as a corrupt file) → `atomicWriteJson`.
- `--local` flag routes the write to `claude-plugins.local.json`; base writes go to `claude-plugins.json`. Both go through the *same* atomic seam and the *same* lock.

**Concurrency:**
- Config write-back joins the existing `withLockedStateTransaction` scope so config + internal state move atomically-together under the one per-scope `.state-lock`. Cross-process last-writer-wins is already the documented model (Pitfall 4 in `state-io.ts`); the config file inherits it for free.

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `write-file-atomic` | `^8.0.0` (cur `8.0.0`) | Node >= 22.x line / >= 20.19.0 baseline as already shipped | Already the project's atomic JSON path; no change. |
| `typebox` | dev `^1.1.38`, cur `1.2.6` | Node >= 20.19.0, ESM-only | `Type.Object` + `Compile` API stable across 1.1→1.2; optional routine bump only. |
| `proper-lockfile` | `^4.1.2` (cur `4.1.2`) | Node >= 20.19.0 | Already powers `withStateGuard`; reused as-is. |
| `node:fs/promises` / `node:path` | built-in | Node >= 20.19.0 (NFR-4) | No constraint. |
| `memfs` (dev) | `^4.57.2` | Node >= 20.19.0 | Test-only; reused for in-memory reconcile tests. |

## Sources

- `package.json` (this repo, read 2026-06-09) -- confirmed `write-file-atomic@^8.0.0`, `proper-lockfile@^4.1.2`, `typebox` (peer `*`, dev `^1.1.38`), `memfs@^4.57.2`, `yaml@^2.9.0` (dev) present; Node `>=20.19.0` engine. HIGH.
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` (read) -- confirmed the single sanctioned `write-file-atomic` JSON seam (fsync + concurrent-write queue + mkdir-parent). HIGH.
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (read) -- confirmed the load/migrate/validate/save pattern (`Type.Object` + `Compile` + `.Check`/`.Errors`, ENOENT→default, self-check before write) the config files should mirror. HIGH.
- `extensions/pi-claude-marketplace/persistence/migrate.ts` (read) -- confirmed the fire-and-forget best-effort persist + single sanctioned `console.warn` (IL-3) model for first-load generation. HIGH.
- grep across `extensions/`, `tests/` (2026-06-09) -- confirmed `yaml` has zero extension-source import sites. HIGH.
- npm registry (`npm view`, 2026-06-09) -- `write-file-atomic@8.0.0`, `typebox@1.2.6`, `proper-lockfile@4.1.2`, `comment-json@5.0.0` (deps: `esprima`, `array-timsort`; engines `>=6`), `jsonc-parser@3.3.1`. HIGH.
- `.planning/PROJECT.md` (read) -- locked milestone decisions (JSON Pi-native schema, load-time-only reconcile, write-back, `--local`, migrate-from-state), NFR-1 atomic, NFR-5 network policy, Pitfall 4 cross-process model. HIGH.

---
*Stack research for: declarative marketplace/plugin config files (v1.12)*
*Researched: 2026-06-09*
