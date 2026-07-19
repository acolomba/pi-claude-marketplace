---
phase: 65-force-install-update
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/discover.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/domain/index.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - tests/domain/resolver.types.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/update.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 65: Code Review Report

**Reviewed:** 2026-06-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 65 adds `--force` to `install` and `update` so an `unsupported` plugin degrades
(installs only supported components) instead of blocking. The core design — a single
`MaterializablePlugin` materialize path with no special force-degrade branch, gate
selection via `requireForceInstallable` vs `requireInstallable`, and cascade never
forcing — is correctly implemented across the edge handlers, orchestrators, and resolver.

The type-safety compile test (`resolver.types.test.ts`) correctly covers NFR-7: the
`unavailable` arm cannot leak `pluginRoot`, and `requireForceInstallable` narrows to
`MaterializablePlugin`. Force threading from edge handler through both install and update
orchestrators is consistent.

Two quality issues were found: one error-swallowing catch in the skills bridge that masks
real permission errors, and a misleading parameter name in `discover-names.ts`. Four
lower-priority items cover a spurious option on `readdir`, a path-resolution inconsistency
between bridge discovers, a schema version mismatch in a test helper, and a cosmetic
comment gap in `update.ts`.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `hasRegularSkillFile` swallows all I/O errors including EACCES

**File:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts:52-55`

**Issue:** `hasRegularSkillFile` resolves whether a subdirectory of the plugin root contains
a regular file, but its error handler is `.catch(() => null)` — a catch-all that silences
every error, including `EACCES` (permission denied). If a skill directory exists but has
restrictive permissions, the skill is silently skipped rather than surfaced as an error.
This violates the `--force` contract: the operator expects a best-effort install of
*supported* components, but a real permission error is not a "degradable" condition — it
is a system failure that should propagate so the user knows the install is incomplete
beyond the declared unsupported components.

```typescript
// Current (swallows EACCES, EMFILE, etc.):
const hasRegularSkillFile = await fs
  .lstat(path.join(skillDir, "skill.md"))
  .then((s) => s.isFile())
  .catch(() => null);

// Fix: only suppress ENOENT; re-throw everything else
const hasRegularSkillFile = await fs
  .lstat(path.join(skillDir, "skill.md"))
  .then((s) => s.isFile())
  .catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") return null;
    throw err;
  });
```

### WR-02: Misleading parameter name `installable` typed as `MaterializablePlugin`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:29`

**Issue:** The function signature is
`discoverGeneratedNames(plugin: string, installable: MaterializablePlugin)`.
`MaterializablePlugin` is the union `ResolvedPluginInstallable | ResolvedPluginUnsupported`,
so calling the parameter `installable` is a misnomer — it includes the `unsupported` arm
deliberately admitted by Phase 65 to support force-degrade. A future maintainer seeing
`installable: MaterializablePlugin` may incorrectly conclude the parameter was wrongly typed
and tighten it to `ResolvedPluginInstallable`, breaking force-degrade update conflict checks.

**Fix:** Rename the parameter to `resolved` (matching the local name used inside the
orchestrators for the same type) or `materializable`:

```typescript
export async function discoverGeneratedNames(
  plugin: string,
  resolved: MaterializablePlugin,   // was: installable
): Promise<GeneratedNames> {
```

## Info

### IN-01: Spurious `encoding` option on `readdir` with `withFileTypes: true`

**File:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts:41`

**Issue:** The call passes `{ withFileTypes: true, encoding: "utf8" }`. When
`withFileTypes: true` is set, Node returns `Dirent` objects, not strings, so the
`encoding` option has no effect on the returned values. It adds noise and may mislead
readers into thinking it controls something.

**Fix:** Remove the `encoding` option:
```typescript
const entries = await fs.readdir(pluginRoot, { withFileTypes: true });
```

### IN-02: Inconsistent `componentPath` resolution between skills and commands bridges

**File:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts:103-105` vs
`extensions/pi-claude-marketplace/bridges/commands/discover.ts:82-84`

**Issue:** The commands bridge uses `path.resolve(pluginRoot, entry.name)` to produce
`componentPath`, while the skills bridge uses `path.join(pluginRoot, entry.name)`. When
`pluginRoot` is absolute (the normal case), both produce the same result. If a relative
`pluginRoot` is ever passed, `path.join` preserves it relative while `path.resolve`
normalises to absolute. The inconsistency is a latent divergence waiting for a caller
to pass a relative root.

**Fix:** Align the skills bridge with the commands bridge:
```typescript
componentPath: path.resolve(pluginRoot, entry.name),
```

### IN-03: `schemaVersion: 1` in `seedUnsupportedCandidate` while all other helpers use `schemaVersion: 2`

**File:** `tests/edge/handlers/plugin/update.test.ts:303`

**Issue:** `seedUnsupportedCandidate` seeds state with `schemaVersion: 1`, but every
other test helper in the file and in the install test file uses `schemaVersion: 2`. This
means the FORCE-02 force-update tests exercise the migration code path before reaching the
update logic, which is almost certainly not the intent — and means the test is not
isolating the force-update behavior.

**Fix:** Set `schemaVersion: 2` consistent with all other helpers, unless a migration
test is specifically intended (in which case add a comment explaining that intent).

### IN-04: Missing phase label in section separator comment in `update.ts`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1226`

**Issue:** The section separator reads:
```
// ─── : prepare into tmp ────────────────────────────────────────────
```
The label token between `───` and `:` is empty. Every other phase-labeled separator in
the same file reads `// ─── Phase N: <description>`. This appears to be a copy-paste
where the phase number was deleted.

**Fix:**
```typescript
// ─── Phase 1: prepare into tmp ─────────────────────────────────────────────
```

---

_Reviewed: 2026-06-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
