---
phase: 57-schema-component-type-payload-extension-tolerance
reviewed: 2026-06-14T11:07:51Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - tests/persistence/state-io.test.ts
  - tests/persistence/migrate.test.ts
  - tests/persistence/locations.test.ts
  - tests/domain/components/hooks.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/domain/resolver-loose.test.ts
  - tests/architecture/hooks-foundation.test.ts
  - tests/architecture/no-hooks-strict-additional-properties.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/cascade.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/transaction/with-state-guard.test.ts
  - tests/edge/handlers/tools.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 57: Code Review Report

**Reviewed:** 2026-06-14T11:07:51Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Phase 57 lands the leaf-foundation HOOK-01 / HOOK-02 / HOOK-03 contract:
admits `hooks` as a supported component kind, adds the additive REQUIRED
`resources.hooks: string[]` field on `PLUGIN_INSTALL_RECORD_SCHEMA` (no
`schemaVersion` bump per D-57-01), exposes the lenient `HOOKS_CONFIG_SCHEMA`
plus `parseHooksConfig` discriminated parser, and routes hook-config
parse failure to a silent `installable: false` flip per D-57-04. The
implementation is broadly clean, well-commented, and the test seed-data
sweep across 22 test files is thorough.

No correctness BLOCKERs found at runtime — schema gates work, the
`if/then` shape on `HOOK_HANDLER_SCHEMA` correctly enforces REQUIRED
`command` when `type === "command"`, migration default-fill is
idempotent, and `loadState` + `saveState` accept the additive field.

The 3 WARNINGs cluster around forward-compatibility traps that Phase 57
ships latent and Phases 59+ will trip if not addressed: an asymmetric
narrow path between list rendering (handles malformed `hooks.json`
correctly) and install rendering (does not, falls through to
`unsupported source`), an `isRecordedButDisabled` predicate that does
not check `resources.hooks.length === 0`, and an undocumented second
sanctioned `console.error` site that conflicts with the CLAUDE.md
IL-2/IL-3 single-site-only stance.

The 3 INFO items capture lower-stakes shape/symmetry questions that the
planner already flagged as Claude's Discretion in 57-CONTEXT.md.

## Warnings

### WR-01: install-time `narrowResolverReasons` does NOT classify the new `"malformed hooks.json: ..."` resolver note; renders `{unsupported source}` instead of `{hooks}`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1526-1573`
**Issue:**
The list/info rendering path uses
`shared/probe-classifiers.ts::narrowResolverNotes`, which classifies any
note containing the substring `"hooks"` to the `hooks` Reason — that
correctly handles the new D-57-04 note format
`"malformed hooks.json: ..."` (verified by `list.test.ts` "D-57-04:
plugin dir with malformed hooks/hooks.json buckets as ⊘ with {hooks}
reason").

The install path uses an orchestrator-local `narrowResolverReasons`
function (install.ts:1526) which classifies reasons via:
1. `manifestFieldTokenFromNote(note)` — only matches `"contains <kind>"`
   prefix. The resolver no longer emits `"contains hooks"` after
   Phase 57 (hooks moved out of `UNSUPPORTED_COMPONENT_KINDS`), so this
   carve-out is now dead for the live code path.
2. `reason.includes("source")` — `"malformed hooks.json: ..."` does NOT
   include `"source"`, falls through.
3. errno substrings — `"malformed hooks.json: ..."` typically does not
   include these.
4. Default fallback: `"unsupported source"` (line 1566).

So if a user runs `/claude:plugin install <plugin>@<marketplace>` against
a plugin whose `hooks/hooks.json` is malformed, the resolver returns
`installable: false` with note `"malformed hooks.json: ..."`. The catch
site in `installPlugin` classifies via `classifyEntityShapeError` →
`narrowResolverReasons` → emits `(unavailable) {unsupported source}`
instead of the correct `(unavailable) {hooks}`.

This is a silent mis-classification on a documented failure surface
(D-57-04's `{unsupported hooks}` reason — renamed in Phase 63 — is
supposed to be `{hooks}` in Phase 57 per `narrowResolverNotes`'s
existing closed set). The list surface gets it right; the install
surface gets it wrong. The Phase 57 install.test does not exercise this
arm.

**Fix:** Add the `note.includes("hooks")` carve-out to
`narrowResolverReasons` BEFORE the `note.includes("source")` branch (the
order matters because `"malformed hooks.json"` does not contain
`"source"` today but a future variant might):

```ts
function narrowResolverReasons(reasons: readonly string[]): readonly ContentReason[] {
  const out: ContentReason[] = [];
  for (const reason of reasons) {
    if (reason === "") {
      continue;
    }

    const manifestFieldToken = manifestFieldTokenFromNote(reason);
    if (manifestFieldToken !== undefined) {
      out.push(manifestFieldToken);
      continue;
    }

    // D-57-04: the new resolver path emits `"malformed hooks.json: ..."`
    // notes that the `contains <kind>` prefix carve-out does NOT match.
    // Mirror `narrowResolverNotes`'s substring rule so install-time
    // rendering matches list-time rendering on hook-config parse failure.
    if (reason.includes("hooks")) {
      out.push("hooks");
      continue;
    }

    if (reason.includes("source")) {
      out.push("unsupported source");
      continue;
    }
    // ... rest unchanged
  }
  // ...
}
```

Also add a Phase 57 install-test regression guard pinning
`{hooks}` (not `{unsupported source}`) for an install against a plugin
whose `hooks/hooks.json` fails parse — `tests/orchestrators/plugin/install.test.ts`
currently has no `HOOK-` or `57-` test markers.

### WR-02: `isRecordedButDisabled` and `isCurrentlyDisabled` predicates do NOT check `resources.hooks.length === 0` — forward-compat trap once Phase 59 populates hooks

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:275-285`
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:175-191`
**Issue:**
Both predicates declare a plugin record "currently disabled" iff
`compatibility.installable && all four resource arrays are empty`. The
four arrays are `skills`, `prompts`, `agents`, `mcpServers`.

`resources.hooks` was added in Phase 57 but is NOT included in the
emptiness check. Today this is benign because install.ts and reinstall.ts
both hard-code `hooks: []` (Phase 57 records empty hooks inventory until
Phase 59/EXEC populates it).

Once Phase 59 (DISP/EXEC) starts populating `resources.hooks` for plugins
that declare a hooks.json, both predicates will misclassify:

  - **Hook-only enabled plugin** (skills/prompts/agents/mcpServers all
    empty, hooks populated): the predicate returns TRUE → the record
    reads as DISABLED, even though it is in fact an enabled hook-only
    plugin. `setPluginEnabled`'s enable branch would refuse to
    re-materialize a record that is "already enabled" because the
    sentinel says it's disabled. Reconcile's planner (`plan.ts:348`,
    `plan.ts:367`) would route this plugin to the re-install branch and
    silently re-materialize on every `/reload`.

This is a latent BLOCKER-class hazard for v1.13 once hooks dispatch
lands. Easier to fix now (one-line additive change, no behavior change
in Phase 57) than to chase through reconcile/enable-disable in Phase 59.

**Fix:** Add the `hooks.length === 0` check to both predicates:

```ts
// extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:275-285
export function isRecordedButDisabled(
  record: ExtensionState["marketplaces"][string]["plugins"][string],
): boolean {
  return (
    record.compatibility.installable &&
    record.resources.skills.length === 0 &&
    record.resources.prompts.length === 0 &&
    record.resources.agents.length === 0 &&
    record.resources.mcpServers.length === 0 &&
    record.resources.hooks.length === 0
  );
}
```

Same one-line addition to `isCurrentlyDisabled` in
`enable-disable.ts:184-190`. Also widen the structural argument type on
the latter to include `hooks: readonly string[]`.

Note: `applyPartialCascadeFold` in `orchestrators/plugin/shared.ts:687-710`
has the same shape: it filters skills/prompts/agents/mcpServers but not
hooks. Pre-emptively adding a `hooks` filter is acceptable but optional
in Phase 57 since the field is always empty today; flag it for Phase 59
to add when hooks are first populated.

### WR-03: `domain/components/hooks.ts` introduces a SECOND sanctioned `console.error` site that is not numbered IL-N; conflicts with CLAUDE.md's "single sanctioned `console.warn`" stance

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:150-154`
**Issue:**
CLAUDE.md states: "All user-visible messages MUST go through
`ctx.ui.notify(message, severity)`; direct `process.stdout`/`process.stderr`
writes forbidden in command/bridge code (IL-2). Single sanctioned
`console.warn` is the load-time legacy migration save failure (IL-3)."

`hookDebugLog` writes to `process.stderr` via `console.error`, gated on
`PI_CLAUDE_MARKETPLACE_DEBUG === "1"`. This is a SECOND sanctioned site
that is:

1. Not assigned an IL-N number in the comment, project docs, or PRD.
2. Permitted only via a per-file ESLint override at
   `eslint.config.js:167-171` plus a self-described "retires with the
   OBS-01 swap" doc comment.
3. Functionally similar to IL-3 but undocumented in CLAUDE.md's
   instructional-level contract.

The risk: the carve-out is invisible to a future reviewer who reads
CLAUDE.md and concludes the contract is "no `console.*` outside
`persistence/migrate.ts`". OBS-01 ships in a later phase, and the
"retires" promise depends on that landing. If OBS-01 slips or scope-cuts
further, this `console.error` stays — and the IL-N numbering has not
been amended.

Additionally, the gating condition `process.env.PI_CLAUDE_MARKETPLACE_DEBUG`
is read on EVERY call to `parseHooksConfig`. This is acceptable for
correctness but ties the public seam to an env-var that has no project-
wide convention (the v1.13 milestone introduces this var here for the
first time; no other extension code reads it).

**Fix:** EITHER
1. Assign an explicit IL-N (e.g. IL-3.1 or a fresh IL-4) and add a
   `CLAUDE.md` line documenting the second sanctioned site with its
   ESLint-override path and the retire-on-OBS-01 contract, OR
2. Replace `console.error` with the OBS-01 helper now (preferred — the
   helper is a one-call seam and shipping it stub-first then swap-later
   doubles the policy surface), OR
3. If neither is acceptable for Phase 57's scope, add a one-liner JSDoc
   note on `hookDebugLog` explicitly cross-referencing IL-2/IL-3 and
   acknowledging the policy debt:

```ts
/**
 * OBS-01 hand-off seam. SECOND sanctioned `console.error` callsite
 * (IL-2 exception parallel to IL-3 in persistence/migrate.ts -- pending
 * IL-N assignment). Gated on PI_CLAUDE_MARKETPLACE_DEBUG === "1"; retires
 * when OBS-01 replaces this stub with a shared debug-log helper. The
 * per-file ESLint override at eslint.config.js:167-171 disables
 * no-console + no-restricted-syntax for this single file ONLY.
 */
```

The current comment says "the per-file ESLint override that permits
`console.error` for this stub retires with the OBS-01 swap" but does
not name the IL contract being amended. A reviewer auditing IL-2
compliance via grep finds two `console.*` writes and no documented
second exception in CLAUDE.md.

## Info

### IN-01: `applyHooksConfig` does NOT set `partial.hooksConfigPath` on the parse-failure path; comment on `ResolvedPluginNotInstallableSchema.hooksConfigPath` claims symmetry "so downstream consumers can read the marker without narrowing on `installable`"

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:81-85, 672-691`
**Issue:** The schema documents that `hooksConfigPath` is "symmetric
with the installable variant so downstream consumers can read the marker
without narrowing on `installable`". The implementation only sets
`partial.hooksConfigPath` on the SUCCESS path (line 686); the
parse-failure path (line 679, `if (!hooksResult.ok)`) returns `true`
(dirty) without populating `hooksConfigPath`. So a not-installable
record from a malformed `hooks.json` carries `hooksConfigPath:
undefined`, exactly the same shape as a not-installable record from a
plugin with NO hooks.json on disk.

This is a doc/implementation mismatch — the field is optional so the
behavior is type-correct, but the comment promises a marker that isn't
populated on the failure path. Either populate it (the relative path
is computable: `path.join("hooks", "hooks.json")`) so consumers can
distinguish "no hooks file" vs "broken hooks file" without parsing
notes, or update the comment to clarify "populated only on successful
parse".

**Fix:** Prefer populating on the failure path too (file exists, we just
couldn't parse it):

```ts
async function applyHooksConfig(
  ctx: ResolveContext,
  pluginRoot: string,
  partial: PartialResolution,
): Promise<boolean> {
  const hooksResult = await readStandaloneHooks(ctx, pluginRoot);
  if (!hooksResult.ok) {
    partial.notes.push(hooksResult.reason);
    // Symmetric marker: the file exists on disk (the not-ok arm only
    // fires after the existence stat); surface it so consumers don't
    // need to substring-parse `notes` for "hooks.json".
    partial.hooksConfigPath = path.join("hooks", "hooks.json");
    return true;
  }
  // ... unchanged
}
```

This also requires `readStandaloneHooks` to carry the relative path on
the failure arm; today the failure branches return only
`{ ok: false, reason }`. Wire the path through both arms.

### IN-02: `HOOK_HANDLER_SCHEMA` static type `HookHandlerEntry` declares `command?: string` (always optional) — does not reflect the runtime `if/then` discriminator that REQUIRES `command` when `type === "command"`

**File:** `extensions/pi-claude-marketplace/domain/components/hooks.ts:51-82`
**Issue:**
The `HookHandlerEntry` TypeScript interface declares `command?: string`
(optional). The runtime schema uses JSON Schema 2020-12 `if/then` to
require `command` when `type === "command"`. So TypeScript-level
consumers reading `entry.command` get `string | undefined` even after
narrowing on `entry.type === "command"`.

The dispatch milestone (Phase 59) consuming this parser will likely want
the precise discriminated type. Today's static shape forces every
consumer to defensive-check `if (entry.command === undefined) { ... }`
even on the type:"command" arm, even though the runtime validator
guaranteed it.

This is documented in the comment block at lines 41-50 ("TypeBox 1.x's
first-class combinators don't compose into a discriminator-with-required-field
shape cleanly"). Acceptable shortcut for Phase 57; flag for Phase 59 to
synthesize a discriminated `HookHandlerCommand | HookHandlerOther`
union if dispatch needs the precision.

**Fix:** No action required in Phase 57. When Phase 59 wires dispatch,
synthesize the discriminated union manually:

```ts
export type HookHandlerCommand = { type: "command"; command: string; /* extensions */ };
export type HookHandlerOther = { type: Exclude<string, "command">; command?: string; /* extensions */ };
export type HookHandlerEntry = HookHandlerCommand | HookHandlerOther;
```

Phase 57 may add a JSDoc note on the interface acknowledging the gap.

### IN-03: `MANIFEST_FIELD_REASONS` set in `install.ts` still contains `"hooks"`, but the resolver no longer emits `"contains hooks"` notes (dead path)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1478-1513`
**Issue:**
With Phase 57's removal of `hooks` from `UNSUPPORTED_COMPONENT_KINDS`,
the resolver's `addUnsupportedKindNotes` no longer iterates over `hooks`
and so never pushes `"contains hooks"` to `partial.notes`. The
`MANIFEST_FIELD_REASONS` set (`{"hooks", "lspServers"}`) and the
`MANIFEST_FIELD_TO_REASON` map still wire `"hooks"` → `"hooks"`, but the
only live path that produces a `"contains hooks"` note is gone.

The legacy test
`tests/orchestrators/plugin/install.test.ts:2228` still asserts
`narrowResolverReasons(["contains hooks"])` returns `["hooks"]`. That
test passes because the function is still wired to recognize the
prefix; it just no longer fires in production.

This is dead-but-harmless. Two cleanup options:
1. Leave it — it's a defensive carve-out for any future resolver path
   that might re-emit the prefix.
2. Remove `"hooks"` from `MANIFEST_FIELD_REASONS` and let the new
   `note.includes("hooks")` carve-out (see WR-01) be the sole hooks
   classifier.

Recommend option 1 (the legacy test is regression cover for any
re-introduction of the prefix; harmless to keep).

**Fix:** Add a comment to `MANIFEST_FIELD_REASONS` noting that the
`"hooks"` token is now defensive (no live resolver path emits
`"contains hooks"` after Phase 57); the carve-out is retained as
forward-compat insurance.

---

_Reviewed: 2026-06-14T11:07:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
