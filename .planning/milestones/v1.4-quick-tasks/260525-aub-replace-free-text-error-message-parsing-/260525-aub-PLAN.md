---
phase: quick-260525-aub
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - tests/shared/errors.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/update.test.ts
autonomous: true
requirements: [CR-02]

must_haves:
  truths:
    - "Install / update / remove / reinstall classify failure outcomes via `instanceof` discriminated checks, not `err.message.includes(...)` / `err.message` regex"
    - "Resolver's `requireInstallable` throws a typed `PluginShapeError` carrying `kind` + `reasons: readonly Reason[]`; the `.message` text is byte-equal to the current `Plugin \"X\" is not installable: a; b; c` form"
    - "Install's PI-3 / PI-5 throws use typed `PluginShapeError` (kinds `not-in-manifest` / `already-installed`); `.message` text byte-equal to current"
    - "`PluginUpdateOutcome` carries `reasons: readonly Reason[]` (pre-narrowed at the producer site); `notes` removed from the consumer contract for skipped/failed partitions"
    - "Marketplace remove's `narrowCascadeFailure` switches on `instanceof AgentsUnstageFailureError` / `NodeJS.ErrnoException` (`.code === 'EACCES'`), never on `cause.message` text"
    - "SonarCloud `typescript:S5852` ReDoS finding at the install.ts:902 regex is eliminated (the regex is deleted, not refactored)"
    - "1254/1254 tests stay green; `npm run check` passes"
    - "Drift guard (`tests/architecture/grammar-frontmatter.test.ts`) stays green -- no new closed-set REASON members introduced"
  artifacts:
    - path: "extensions/pi-claude-marketplace/shared/errors.ts"
      provides: "PluginShapeError discriminated typed error class with kinds: 'not-in-manifest' | 'already-installed' | 'not-installable' | 'no-longer-installable'"
      contains: "export class PluginShapeError"
    - path: "extensions/pi-claude-marketplace/orchestrators/types.ts"
      provides: "PluginUpdateOutcome.reasons: readonly Reason[] (replaces freeform notes for skipped/failed partitions)"
      contains: "readonly reasons?: readonly Reason[]"
  key_links:
    - from: "extensions/pi-claude-marketplace/domain/resolver.ts"
      to: "shared/errors.ts::PluginShapeError"
      via: "requireInstallable throws PluginShapeError"
      pattern: "throw new PluginShapeError"
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
      to: "shared/errors.ts::PluginShapeError"
      via: "classifyEntityShapeError / classifyInstallFailure dispatch on err.kind"
      pattern: "instanceof PluginShapeError"
    - from: "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
      to: "orchestrators/types.ts::PluginUpdateOutcome.reasons"
      via: "outcomeToCascadeRow reads outcome.reasons directly"
      pattern: "outcome\\.reasons"
    - from: "extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"
      to: "orchestrators/marketplace/shared.ts::AgentsUnstageFailureError"
      via: "narrowCascadeFailure instanceof dispatch"
      pattern: "instanceof AgentsUnstageFailureError"
---

<objective>
Replace free-text `Error.message` parsing in install / update / remove / reinstall orchestrators with typed discriminated error classes and pre-narrowed typed outcome fields. Close the systemic v1.3 pattern hole that Phase 13's `ManualRecoveryError` refactor missed in 4 additional catch sites beyond install, and eliminate the SonarCloud ReDoS hotspot (`typescript:S5852`) at `install.ts:902`.

Purpose:
  - Honor NFR-7 (discriminated unions over string parsing) and the Phase 13 `ManualRecoveryError` / `AgentsUnstageFailureError` precedent (CR-06: "structured failure data instead of textual re-parsing").
  - Eliminate the brittle pattern where the throw site stringifies structured `r.notes: readonly Reason[]` (resolver.ts:786) and the catch site re-parses it back via regex / `.split("; ")` / `.includes(...)` (install.ts:874-972, remove.ts:149-172, update.ts:400-449).
  - Delete one regex on user-controlled input (`/is not installable:\s*(.+)$/`) -- the SonarCloud `typescript:S5852` ReDoS hotspot at install.ts:902.

Output:
  - One typed error class (`PluginShapeError`) added to `shared/errors.ts`.
  - `PluginUpdateOutcome.reasons: readonly Reason[]` field added; `notes` retained ONLY for the entity-error-text used by the cascade orchestrator's `composeErrorWithCauseChain` trailer (no consumer parsing).
  - 4 narrow* functions rewritten as compile-time-exhaustive `instanceof` / discriminated switches.
  - 1 regex deleted.
  - All user-visible `.message` text byte-equal to current; 1254/1254 tests green.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/PROJECT.md

# Throw / catch sites under audit (see <interfaces> for the literal current shapes):
@extensions/pi-claude-marketplace/shared/errors.ts
@extensions/pi-claude-marketplace/shared/grammar/reasons.ts
@extensions/pi-claude-marketplace/domain/resolver.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
@extensions/pi-claude-marketplace/orchestrators/types.ts

<interfaces>
<!-- Extracted from the codebase so the executor doesn't have to re-discover. -->

From `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` (the closed REASONS set; do NOT add new members in this task):
```typescript
export const REASONS = [
  "up-to-date", "not found", "already installed", "not installed",
  "not in manifest", "invalid manifest", "no longer installable",
  "unsupported source", "hooks", "lspServers", "requires pi-subagents",
  "requires pi-mcp", "rollback partial", "unreadable", "unparseable",
  "unreadable manifest", "source mismatch", "plugins remain",
  "concurrently uninstalled", "concurrently updated", "stale clone",
  "duplicate name", "lock held", "already enabled", "already disabled",
  "permission denied", "source missing", "network unreachable",
] as const;
export type Reason = (typeof REASONS)[number];
```

From `extensions/pi-claude-marketplace/shared/errors.ts` -- precedent classes to model `PluginShapeError` after:
```typescript
// PRECEDENT 1: ManualRecoveryError -- carries STRUCTURED `leaks` so consumers
// instanceof-check instead of substring-matching the message text.
export class ManualRecoveryError extends Error {
  readonly leaks: readonly string[];
  constructor(message: string, leaks: readonly string[], options?: ErrorOptions) { ... }
}

// PRECEDENT 2: ConcurrentInstallError -- already used by classifyInstallFailure
// via `err instanceof ConcurrentInstallError`. Same pattern: typed dispatch.
export class ConcurrentInstallError extends Error {
  readonly plugin: string;
  readonly marketplace: string;
  ...
}
```

From `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:53-60` -- AgentsUnstageFailureError is ALREADY the typed-carrier shape (CR-06 precedent) that `narrowCascadeFailure` should dispatch on:
```typescript
export class AgentsUnstageFailureError extends Error {
  readonly failedAgents: readonly UnstageAgentFailure[];
  constructor(message: string, failedAgents: readonly UnstageAgentFailure[]) {
    super(message);
    this.name = "AgentsUnstageFailureError";
    this.failedAgents = failedAgents;
  }
}
```

From `extensions/pi-claude-marketplace/domain/resolver.ts:777-787` -- the resolver currently stringifies `r.notes` into the message; this is the upstream loss-of-typing site:
```typescript
export function requireInstallable(
  r: ResolvedPlugin,
  op: "install" | "update" = "install",
): asserts r is ResolvedPluginInstallable {
  if (r.installable) return;
  const verb = op === "update" ? "is no longer installable" : "is not installable";
  throw new Error(`Plugin "${r.name}" ${verb}: ${r.notes.join("; ")}`);
}
```
Note: `r.notes` is `readonly Reason[]` on the `ResolvedPluginNotInstallable` variant, so the typed reasons array is ALREADY available; the throw site just needs to pass it through instead of `join("; ")`-ing it.

From `extensions/pi-claude-marketplace/orchestrators/types.ts:91-135` -- PluginUpdateOutcome current shape:
```typescript
export interface PluginUpdateOutcome {
  readonly partition: "updated" | "unchanged" | "skipped" | "failed";
  readonly name: string;
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly notes?: readonly string[];   // <-- string blob the marketplace orchestrator parses
  readonly stagedAgents?: readonly string[];
  readonly stagedMcpServers?: readonly string[];
  readonly declaresAgents?: boolean;
  readonly declaresMcp?: boolean;
  readonly phaseFailures?: readonly { phase: "skills"|"commands"|"agents"|"mcp"; msg: string }[];
}
```

From `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:296-324` -- the producer of "failed" outcomes for the cascade catches arbitrary throws and stringifies them via `composeErrorWithCauseChain(err)`:
```typescript
async function cascadeAutoupdates(...): Promise<readonly PluginUpdateOutcome[]> {
  ...
  for (const plugin of snapshot.plugins) {
    try { outcomes.push(await pluginUpdate(plugin, name, scope)); }
    catch (err) {
      outcomes.push({
        partition: "failed",
        name: plugin,
        notes: [composeErrorWithCauseChain(err)],   // string blob
      });
    }
  }
}
```

From `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:273-301` -- the `updateSinglePlugin` PluginUpdateFn impl does the same conversion (cascade-safe contract: never throws):
```typescript
export const updateSinglePlugin: PluginUpdateFn = async (plugin, marketplace, scope) => {
  ...
  try { return await runThreePhaseUpdate({ ... }); }
  catch (err) {
    return {
      partition: "failed",
      name: plugin,
      notes: [composeErrorWithCauseChain(err)],
    };
  }
};
```
</interfaces>

<test_assertions_preserved>
<!-- These existing test assertions MUST continue to pass against the new typed throws.
     The byte-equal .message preservation is what keeps them green. -->

From `tests/domain/resolver-strict.test.ts:346-368`:
  - PR-6: `err.message.includes('Plugin "p1" is not installable')` (install op)
  - PR-6: `err.message.includes("is no longer installable")` (update op)

From `tests/orchestrators/plugin/install.test.ts`:
  - line 324: `assert.match(notifications[0]?.message ?? "", /not found in marketplace/)`
  - line 359: same /not found in marketplace/
  - line 405: `assert.match(... /is not installable/)`
  - line 445, 951: `assert.match(... /is already installed/)`
  - line 1170: `assert.match(... /not found in marketplace "mp"/)` -- exact mp-name interpolation

From `tests/orchestrators/plugin/update.test.ts:302-330`:
  - PUP-4: `'is no longer installable'` (will now reach the catch as `kind="no-longer-installable"`)
</test_assertions_preserved>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define PluginShapeError + migrate throw sites + extend PluginUpdateOutcome</name>
  <files>
    extensions/pi-claude-marketplace/shared/errors.ts,
    extensions/pi-claude-marketplace/domain/resolver.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/types.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    tests/shared/errors.test.ts
  </files>
  <behavior>
    PluginShapeError tests (NEW file `tests/shared/errors.test.ts`, expand existing if present):
    - Constructing PluginShapeError with `{ kind: "not-in-manifest", plugin: "p", marketplace: "mp" }` -> `.message` equals `Plugin "p" not found in marketplace "mp".`
    - Constructing with `{ kind: "already-installed", plugin: "p", marketplace: "mp" }` -> `.message` equals `Plugin "p" is already installed in marketplace "mp".`
    - Constructing with `{ kind: "not-installable", plugin: "p1", reasons: ["hooks", "lspServers"] }` -> `.message` equals `Plugin "p1" is not installable: hooks; lspServers`
    - Constructing with `{ kind: "no-longer-installable", plugin: "p1", reasons: ["unsupported source"] }` -> `.message` equals `Plugin "p1" is no longer installable: unsupported source`
    - `.name === "PluginShapeError"`; `instanceof Error`; `instanceof PluginShapeError`.
    - `.kind`, `.plugin`, `.reasons` (when applicable), `.marketplace` (when applicable) are readonly and survive `JSON.stringify` round-trip via `.toJSON()` if you choose to add one (optional -- existing precedents do not).

    Resolver tests (existing `tests/domain/resolver-strict.test.ts:346-368`):
    - `requireInstallable(r, "install")` on not-installable -> throws `PluginShapeError`; `err instanceof PluginShapeError && err.kind === "not-installable"`; `err.reasons` deep-equals the original `r.notes` (typed `Reason[]`).
    - `requireInstallable(r, "update")` -> kind `"no-longer-installable"`.
    - Both byte-equal `.message` to the current form (the existing `err.message.includes(...)` assertions stay green unchanged).

    Install tests (existing `tests/orchestrators/plugin/install.test.ts`):
    - PI-3, PI-5 throws now use `PluginShapeError`; existing `assert.match(/not found in marketplace/)` and `/is already installed/` regex assertions stay green because `.message` is byte-equal.
  </behavior>
  <action>
    Per D-30 / NFR-7 precedent (ManualRecoveryError, AgentsUnstageFailureError):

    1. **Define `PluginShapeError` in `extensions/pi-claude-marketplace/shared/errors.ts`** next to `ManualRecoveryError`. Discriminated by `kind`:
       - Kinds: `"not-in-manifest" | "already-installed" | "not-installable" | "no-longer-installable"`.
       - Common readonly fields: `kind`, `plugin: string`.
       - `"not-in-manifest"` / `"already-installed"` carry `marketplace: string` (used in the message text).
       - `"not-installable"` / `"no-longer-installable"` carry `reasons: readonly Reason[]` (typed array from the resolver, NOT a string blob).
       - The constructor builds `.message` from the discriminant -- single source of truth. Required exact forms:
         * `not-in-manifest`: `Plugin "<plugin>" not found in marketplace "<marketplace>".` (mirrors install.ts:263 / install.ts:294 -- includes trailing period)
         * `already-installed`: `Plugin "<plugin>" is already installed in marketplace "<marketplace>".` (mirrors install.ts:285 -- includes trailing period)
         * `not-installable`: `Plugin "<plugin>" is not installable: <reasons.join("; ")>` (mirrors resolver.ts:786 -- NO trailing period)
         * `no-longer-installable`: `Plugin "<plugin>" is no longer installable: <reasons.join("; ")>` (mirrors resolver.ts:786 -- NO trailing period)
       - Implementation choice: a single class with a discriminated constructor-arg union is cleanest. Pattern:
         ```typescript
         type Shape =
           | { kind: "not-in-manifest"; plugin: string; marketplace: string }
           | { kind: "already-installed"; plugin: string; marketplace: string }
           | { kind: "not-installable"; plugin: string; reasons: readonly Reason[] }
           | { kind: "no-longer-installable"; plugin: string; reasons: readonly Reason[] };
         export class PluginShapeError extends Error { ... }
         ```
         The class exposes the union fields via getters or stores them on the instance; pick whichever reads cleanly. Use `assertNever(shape)` in a default branch when building the message so adding a new kind is a compile-time error.
       - `cause` support: forward an optional `options?: ErrorOptions` to `super(message, options)` (matches `ManualRecoveryError`).
       - `this.name = "PluginShapeError"`.

    2. **Migrate `domain/resolver.ts:777-787` `requireInstallable`**: pass the typed `r.notes` (already `readonly Reason[]` on the not-installable variant) into a new `PluginShapeError({ kind: op === "update" ? "no-longer-installable" : "not-installable", plugin: r.name, reasons: r.notes })`. Delete the `verb` local and the `r.notes.join("; ")` -- the class owns message composition.

    3. **Migrate `orchestrators/plugin/install.ts:263, 285, 294`** to throw typed errors:
       - line 263 / 294: `throw new PluginShapeError({ kind: "not-in-manifest", plugin, marketplace })`
       - line 285: `throw new PluginShapeError({ kind: "already-installed", plugin, marketplace })`
       - The schema-validation throw at lines 301-305 stays as a bare `Error` for now -- it's a defensive defense-in-depth surface, not a user-contract message; out of scope for this task.

    4. **Extend `orchestrators/types.ts::PluginUpdateOutcome`** with a new optional field `readonly reasons?: readonly Reason[]`. KEEP `notes?: readonly string[]` for now (still used for the cause-chain trailer text in the `composeErrorWithCauseChain` path that feeds notifyError trailers). The contract is: `reasons` is consumed by the renderer (`outcomeToCascadeRow`); `notes` is the cause-chain string blob consumed ONLY by the notifyError trailer.

    5. **Producer sites in `orchestrators/plugin/update.ts`** -- populate `reasons` at every `partition: "skipped"` / `partition: "failed"` return site (per the producer locations grep'd at update.ts:296, 366, 374, 381, 390, 405, 681):
       - line 296-300 (catch in `updateSinglePlugin`): inspect `err` -- if `instanceof PluginShapeError && err.kind === "no-longer-installable"`, set `reasons: ["no longer installable"]`. Else leave `reasons` undefined and let the downstream `narrowFailReason` fallback apply.
       - line 366-370 ("marketplace not found in scope"): `reasons: ["not in manifest"]`.
       - line 374 ("not installed"): `reasons: ["not installed"]`.
       - line 380-385 ("not in manifest"): `reasons: ["not in manifest"]`.
       - line 388-394 ("entry failed schema validation"): `reasons: ["invalid manifest"]`.
       - line 403-409 (catch around `resolveStrict` + `requireInstallable`): the caught `err` is now `PluginShapeError` with `kind === "no-longer-installable"`; populate `reasons: ["no longer installable"]`. Preserve `notes: [errorMessage(err)]` for the trailer.
       - line 681 (whatever this site does -- inspect and apply the same pattern: dispatch on `instanceof PluginShapeError ? err.kind : <other typed error>` to populate `reasons`).

    Do NOT change the catch sites in this task -- Task 2 owns that. Producers MUST still populate `notes` so cause-chain trailers stay correct.

    **No fenced code in the action body beyond what's shown above for spec-clarity** -- the executor uses the message-form table above as the byte-equal contract.

    **Constraint**: no new REASONS member is added; the drift guard at `tests/architecture/grammar-frontmatter.test.ts` MUST stay green. All `reasons` values must be from the existing closed set (see `<interfaces>`).
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && npm run test -- --test-name-pattern='PluginShapeError|PR-6 requireInstallable|PI-3|PI-5' 2>&1 | tail -40</automated>
  </verify>
  <done>
    - `PluginShapeError` class exists in `shared/errors.ts` with the 4 documented kinds and byte-equal message forms.
    - `requireInstallable`, `install.ts:263/285/294` all throw `PluginShapeError`.
    - `PluginUpdateOutcome.reasons?: readonly Reason[]` added to the contract; every plugin/update.ts skipped/failed return site populates it with an in-set `Reason`.
    - `tests/shared/errors.test.ts` covers the 4 kinds + byte-equal message forms.
    - Existing resolver / install tests stay green unchanged (no test edits required because `.message` is byte-equal).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Migrate catch sites to typed dispatch + delete S5852 regex + update marketplace consumers</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts,
    tests/orchestrators/plugin/install.test.ts,
    tests/orchestrators/marketplace/remove.test.ts,
    tests/orchestrators/marketplace/update.test.ts
  </files>
  <behavior>
    Catch-site dispatch tests (NEW assertions to add ONE per migrated catch site -- guard against regression to substring matching):
    - `classifyEntityShapeError`: passing a `PluginShapeError({ kind: "already-installed", ... })` returns an `EntityErrorRow` with `status: "failed"`, `reasons: ["already installed"]`. Passing a `PluginShapeError({ kind: "not-installable", reasons: ["hooks"] })` returns `status: "unavailable"`, `reasons` preserves the typed array verbatim (no re-narrowing roundtrip through string parsing).
    - `classifyInstallFailure`: passing a `PluginShapeError({ kind: "not-in-manifest", ... })` returns `status: "unavailable"`; `kind: "already-installed"` returns `status: "already-installed"`; `kind: "not-installable"` or `"no-longer-installable"` returns `status: "uninstallable"`.
    - `narrowCascadeFailure` in remove.ts: passing an `AgentsUnstageFailureError` returns `"not in manifest"` (current default), passing a `NodeJS.ErrnoException` with `code: "EACCES"` returns `"permission denied"` (USE the existing closed-set REASON; no new member). Document the mapping so a future test adding "ENOENT -> source missing" has a clear precedent.
    - `narrowSkipReason` / `narrowFailReason` in marketplace/update.ts: now read `outcome.reasons` directly when populated; the existing string parsing of `notes` is the FALLBACK only when `reasons` is undefined (preserves backward compatibility with tests that build outcomes without reasons).

    Byte-equality:
    - Every `notifyError` / `notifyWarning` body string emitted by these orchestrators is identical to before (verified by the catalog UAT byte-equality runner at `tests/architecture/catalog-uat.test.ts` if present, and by the existing per-site test assertions).
  </behavior>
  <action>
    1. **`orchestrators/plugin/install.ts:874-918` `classifyEntityShapeError`**: rewrite to dispatch on `err instanceof PluginShapeError`. Switch on `err.kind`:
       - `"already-installed"` -> `EntityErrorRow{status:"failed", reasons:["already installed"]}`
       - `"not-in-manifest"` -> `EntityErrorRow{status:"failed", reasons:["not in manifest"]}`
       - `"not-installable"` / `"no-longer-installable"` -> `EntityErrorRow{status:"unavailable", reasons: err.reasons}` -- pass the typed `Reason[]` straight through (no re-narrowing; the resolver pre-narrowed it).
       - default (non-PluginShapeError): return `undefined` (existing fallback to bare `errorMessage(err)`).
       - Delete the helper `narrowNotInstallableReasons` and the `MANIFEST_FIELD_REASONS` Set -- they exist solely to re-narrow the stringified-then-resplit notes. With `err.reasons` typed at the source, no narrowing is needed.
       - **Delete the regex `/is not installable:\s*(.+)$/`** at line 902 -- this is the SonarCloud S5852 ReDoS hotspot. The new dispatch makes it dead code.

    2. **`orchestrators/plugin/install.ts:954-972` `classifyInstallFailure`**: rewrite to dispatch on `err instanceof PluginShapeError`. Switch on `err.kind`:
       - `"already-installed"` -> `{status:"already-installed", cause}` (also covered by the existing `ConcurrentInstallError` branch -- keep that branch separately).
       - `"not-in-manifest"` -> `{status:"unavailable", cause}`
       - `"not-installable"` / `"no-longer-installable"` -> `{status:"uninstallable", cause}`
       - non-PluginShapeError -> `{status:"unexpected-failure", cause}`.

    3. **`orchestrators/plugin/reinstall.ts`** -- audit the existing `narrowReason` / `narrowReasons` (lines 583, 603, 608, 658) referenced via the grep. If these read `outcome.notes` text from a `ReinstallFailedOutcome`, mirror the same pattern: if the outcome carries a typed `reasons` (likely already set by reinstall code), prefer that; otherwise the existing substring fallback stays as a back-compat path. **Constraint**: do NOT extend reinstall's outcome contract in this task -- the audit may show it's already typed, in which case the only work here is to delete dead `narrow*` branches that exist solely to handle the old `requireInstallable` stringified throw form. If reinstall already handles `PluginShapeError` cleanly via its existing `instanceof` branches, leave it alone and note that in the SUMMARY.

    4. **`orchestrators/marketplace/remove.ts:149-172` `narrowCascadeFailure`**: rewrite to dispatch on the typed cause:
       - `cause instanceof AgentsUnstageFailureError` -> the per-agent `failedAgents[]` array is already structured; pick the appropriate Reason. With no closed-set member specifically for foreign-content / agent-removal failures, keep the current fallback `"not in manifest"` (NOT introducing a new REASON here -- that would require a frontmatter + drift-test sync per D-CMC-11 and is out of scope).
       - `cause` shaped as `NodeJS.ErrnoException` (`typeof cause === "object" && cause !== null && "code" in cause`): switch on `cause.code`:
         * `"EACCES"` / `"EPERM"` -> `"permission denied"` (closed-set member added in Phase 13 Wave 3 -- already in REASONS).
         * `"ENOENT"` -> `"source missing"` (closed-set member -- already in REASONS, applies when the agent file / index path is gone).
         * default -> `"not in manifest"` (existing fallback).
       - Default (other Error types) -> `"not in manifest"`.
       - Document in a code comment that the `text.includes("unreadable")` / `text.includes("unparseable")` paths are no longer reachable because the bridges that produce those reasons throw typed errors (or, if they throw bare `Error`, file a follow-up note in the SUMMARY). KEEP the textual fallback ONLY as a defensive last resort for un-typed throws from third-party code -- never as the primary classification path. If after the audit you find the unreadable/unparseable substring branches were dead code, delete them.

    5. **`orchestrators/marketplace/update.ts:400-449` `narrowSkipReason` / `narrowFailReason`**: rewrite to:
       - First check `outcome.reasons?.[0]` (typed Reason from Task 1's producer migration). If present, return it directly (no string parsing). This is the primary path.
       - Fall back to the existing string-parsing-of-notes path ONLY when `outcome.reasons` is undefined -- preserves backward compat for tests that build outcomes without `reasons`. Mark the fallback path with a TODO comment explaining the migration plan: "once all producers populate `reasons`, this fallback can be deleted; today the test fixture path at <file:line> still constructs notes-only outcomes."
       - Change the signatures so they take the full `outcome` (or both `reasons` and `notes`), not just `notes`. Update the callers at `outcomeToCascadeRow` lines 381 / 389 accordingly.

    6. **Add discriminated-dispatch tests** to:
       - `tests/orchestrators/plugin/install.test.ts`: 2 NEW tests asserting `classifyEntityShapeError`'s and `classifyInstallFailure`'s typed dispatch (one per kind covered). Keep these LOCAL to the file (export the helpers if needed via a test-only re-export, or test through the orchestrator entry point if the helpers stay private).
       - `tests/orchestrators/marketplace/remove.test.ts`: 1 NEW test for `narrowCascadeFailure` with a synthetic `NodeJS.ErrnoException` (`code: "EACCES"`) -- asserts the result is `"permission denied"`. Skip the test entirely if `narrowCascadeFailure` is not exported; the architecture rule against widening a private surface for tests applies (see PROJECT.md if needed).
       - `tests/orchestrators/marketplace/update.test.ts`: 1 NEW test asserting `outcomeToCascadeRow` reads `outcome.reasons` directly when populated (no notes parsing).
       - **Do NOT modify existing assertions on `.message` substrings** -- byte-equal preservation keeps them green.

    7. **Byte-equality recheck**: after all migrations, run the catalog UAT byte-equality test if it exists (`tests/architecture/catalog-uat.test.ts`) and `npm run check`. Any byte-level diff in rendered output is a regression -- the typed dispatch must produce identical user-visible output.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && npm run check 2>&1 | tail -40</automated>
  </verify>
  <done>
    - `classifyEntityShapeError` and `classifyInstallFailure` dispatch on `instanceof PluginShapeError` + `.kind`; no `err.message.includes(...)` substring matching remains on those code paths.
    - The regex at `install.ts:902` is DELETED (grep `is not installable:\\\\s\*` returns no matches in `orchestrators/`).
    - `narrowCascadeFailure` dispatches on `instanceof AgentsUnstageFailureError` + `NodeJS.ErrnoException.code`; no `cause.message.toLowerCase().includes(...)` remains except possibly as a documented defensive fallback.
    - `narrowSkipReason` / `narrowFailReason` read `outcome.reasons` first; notes-fallback is clearly documented as transitional.
    - `npm run check` green (typecheck + lint + Prettier + 1254 tests).
    - SonarCloud `typescript:S5852` finding at `install.ts:902` resolved (regex deleted).
    - All existing test assertions on `.message` substrings still pass unchanged.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| domain/resolver → orchestrator | `r.notes` array crosses from resolver into orchestrator catch sites; previously stringified-then-resplit, now passed typed through `PluginShapeError.reasons` |
| OS / filesystem → orchestrator | `NodeJS.ErrnoException` from `fs/promises` operations bubbles into `narrowCascadeFailure`; classified via `.code` discriminator, not `.message` |
| user-supplied plugin entries → renderer | manifest plugin name / marketplace name flow into the message string; trust boundary preserved by quoting in template literals (unchanged from current) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-AUB-01 | DoS (ReDoS) | install.ts:902 `/is not installable:\s*(.+)$/` regex | mitigate | Regex DELETED -- typed `PluginShapeError.reasons` array replaces the parse path. SonarCloud `typescript:S5852` closed. |
| T-AUB-02 | Tampering | message-text-based dispatch in install/update/remove catch sites | mitigate | Replaced with `instanceof` discriminated-class dispatch; message text becomes user-facing display only, not control-flow input. Eliminates "if attacker controls a manifest field that happens to contain the substring 'is not installable', they can flip the classification" class of bugs (low impact today because the substrings are narrow, but the new pattern removes the surface entirely). |
| T-AUB-03 | Spoofing / Confusion | external Node OS errors (`ENOENT`, `EACCES`) substring-matched as English text | mitigate | Switch to `NodeJS.ErrnoException.code` discriminator -- locale-independent, type-checked, immune to message-format changes between Node versions (NFR-4 floor `>=22`). |
| T-AUB-04 | Information disclosure | typed errors must not leak more data than the previous `.message` form | accept | Byte-equal `.message` preservation is a Task-1 acceptance criterion; the structured fields (`reasons`, `kind`, `plugin`) are not emitted to the user surface -- they live only on the `Error` instance for code dispatch. No new disclosure. |
</threat_model>

<verification>
1. **Drift guard stays green**: `tests/architecture/grammar-frontmatter.test.ts` -- this task introduces no new REASONS member (asserted; the `reasons` field on `PluginShapeError` is typed as `readonly Reason[]` from the existing closed set).
2. **SonarCloud S5852 resolved**: `grep -rn 'is not installable:\\s' extensions/pi-claude-marketplace/orchestrators/` returns no matches.
3. **No substring dispatch on user-controlled error messages**: `grep -rn 'message.*includes.*"is not installable"\|message.*includes.*"is already installed"\|message.*includes.*"not found in marketplace"' extensions/pi-claude-marketplace/orchestrators/` returns no matches in production code (test files exempt).
4. **`npm run check` green** -- typecheck + ESLint + Prettier + 1254 tests.
5. **Catalog UAT byte-equality** (if `tests/architecture/catalog-uat.test.ts` exists) -- all rendered outputs identical pre/post.
</verification>

<success_criteria>
- 1 new typed error class (`PluginShapeError`) with 4 discriminated kinds; constructor builds byte-equal `.message` text from the discriminant.
- 4 throw sites migrated (resolver.ts:786, install.ts:263/285/294) -- no message-string composition at the throw site.
- 5 catch sites migrated (install.ts:874-918, install.ts:954-972, remove.ts:149-172, update.ts:400-419, update.ts:426-449) -- typed dispatch; no `.message.includes(...)` / regex on user-controlled error text.
- 1 SonarCloud ReDoS hotspot (`typescript:S5852` at install.ts:902) eliminated by regex deletion.
- `PluginUpdateOutcome.reasons: readonly Reason[]` field added; all producers in `plugin/update.ts` populate it on skipped/failed partitions; consumer (`marketplace/update.ts::outcomeToCascadeRow`) prefers `reasons` over notes-string-parsing.
- All existing `.message` substring test assertions stay green unchanged (byte-equal preservation).
- `npm run check` green; 1254/1254 tests pass.
- Single commit on branch `gsd/v1.3-replan-catalog` with Conventional Commits message; pre-commit hook clean (run `pre-commit run --files <changed>` before commit).
</success_criteria>

<output>
Create `.planning/quick/260525-aub-replace-free-text-error-message-parsing-/260525-aub-SUMMARY.md` when done, following `.claude/get-shit-done/templates/summary.md`. The SUMMARY should record:
- The 4 throw sites + 5 catch sites migrated.
- Confirmation the S5852 regex is deleted.
- Confirmation no new REASONS member was added.
- The `PluginUpdateOutcome.notes` field retention rationale (cause-chain trailer composition) so a future cleanup task can plan the full notes-removal.
- Any architectural audit findings on `orchestrators/plugin/reinstall.ts` if it was found to already handle `PluginShapeError` cleanly.
- Single commit SHA + Conventional Commits subject line.
</output>
