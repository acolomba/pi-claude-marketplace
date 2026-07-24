---
phase: 03-desired-state-output-atomic-catalog-supersession
reviewed: 2026-06-25T00:54:18Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-25T00:54:18Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the phase-3 notification-refactor changes covering the D-02 leading-sentence grammar,
D-03 mixed-subject detection, OUT-03/04 trailing tally, D-01 absent-target severity stamps, and
the single `ctx.ui.notify` seam.

The bulk cascade path, tally composition, mixed-subject counting, `Messaging.label` threading,
and D-01 coverage in `update.ts` and `uninstall.ts` are all correct. Two blockers were found:
an indefinite article grammar defect in `summaryPhrase` (`"A operation"` when count=1 and
subject is null), and a silent notification gap in the standalone `reinstallPlugin` path that
drops the D-01 error row for the not-installed case. Four warnings cover a misleading JSDoc in
`notify-context.ts`, missing `severity` stamps on import unavailable rows, a missing `cause`
field on import failed rows, and an empty-reasons edge case on the `PluginFailedMessage` render.
Two info items flag forbidden "Pitfall N" references in `info.ts`.

## Critical Issues

### CR-01: `summaryPhrase` produces "A operation" for count=1 mixed-subject

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2305`

**Issue:** `summaryPhrase` assigns `article = singular ? "A" : "Some"`. When `count === 1` and
`subject === null` (mixed-subject D-03 case), `subjectWord` is `""`, so the result is
`"A operation has failed."` — "A" before a vowel-initial word is grammatically wrong; it must
be "An". This path fires in practice: `buildSummaryLineForCascade` reaches it whenever exactly
one row spans both plugin and marketplace subjects.

**Fix:**
```typescript
// notify.ts:2304-2305
const singular = count === 1;
// "An" before "operation" (vowel-initial); "Some" for plural
const article = singular
  ? subject === null ? "An" : "A"
  : "Some";
```

Alternatively, derive the article after `subjectWord` is known:
```typescript
const subjectWord = subject === null ? "" : `${subject} `;
const noun = `${subjectWord}${operationWord}`;
const article = singular
  ? /^[aeiou]/i.test(noun) ? "An" : "A"
  : "Some";
return `${article} ${noun} ${verbPhrase}.`;
```

---

### CR-02: Standalone `reinstallPlugin` silently skips D-01 notify for not-installed case

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:256-258`

**Issue:** When `locked.outcome.partition !== "reinstalled"` (i.e., `partition === "skipped"`,
which is the "not installed" case D-01 targets), the function returns `locked.outcome` with no
`notifyWithContext` call. The standalone single-plugin reinstall path emits no user-visible
notification at all — the D-01 requirement that not-installed resolves to an `error` row is
only satisfied in the bulk cascade path (`outcomeToPluginMessage`, line ~875), not here.

The bulk path correctly stamps `severity: "error"` for `reasons.includes("not installed")`.
The standalone path does nothing.

```typescript
// reinstall.ts:256-258 (current — silent)
if (locked.outcome.partition !== "reinstalled") {
  return locked.outcome;  // No notify emitted
}
```

**Fix:** Mirror the structure used for the success path (lines 288-299) to emit a skipped/error
row before returning:

```typescript
if (locked.outcome.partition !== "reinstalled") {
  if (render !== "none") {
    const reasons = narrowReasons(locked.outcome.notes);
    const skippedRow: PluginSkippedMessage = {
      status: "skipped",
      name: plugin,
      reasons,
      severity: reasons.includes("not installed") ? "error" : skipSeverity(reasons),
      needsReload: false,
    };
    notifyWithContext(ctx, pi, REINSTALL_CONTEXT, [
      { name: marketplace, scope, plugins: [skippedRow] },
    ]);
  }
  return locked.outcome;
}
```

`PluginSkippedMessage` and `narrowReasons` are already imported and used elsewhere in this
file. `skipSeverity` is already defined in this file.

---

## Warnings

### WR-01: `notifyWithContext` JSDoc incorrectly states severity/needsReload are not read

**File:** `extensions/pi-claude-marketplace/shared/notify-context.ts:126-128`

**Issue:** The JSDoc at lines 126-128 says:

> "the inert `severity?` / `needsReload?` row fields are NOT read here (reduction lands later)"

This is factually wrong. `notifyWithContext` calls `emitContextCascade` which calls
`emitWithSummary` which calls `computeSeverity` which calls `cascadeSeverity` — which reads
every row's `severity` field to MAX-reduce the envelope severity. The fields are read on every
call. A reader who trusts this JSDoc will incorrectly assume severity stamps have no effect
until some later phase, and may omit stamps thinking them inert.

**Fix:** Update the JSDoc to reflect reality:

```typescript
// D-07: `context.render` and `Messaging.label` are the only members consumed
// for the per-row body rendering; `severity?` / `needsReload?` are read by
// `computeSeverity` / `cascadeSeverity` to MAX-reduce the envelope severity
// and determine whether the reload-hint trailer fires.
```

---

### WR-02: `PluginUnavailableMessage` rows in import carry no `severity` stamp

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:449-454`

**Issue:** The `warnings` loop builds `PluginUnavailableMessage` rows with no `severity` field.
`cascadeSeverity` treats absent severity as `"info"` (its `?? "info"` default). Import warnings
(`"plugin-unavailable"`, `"dependency-unavailable"` reasons) are actionable and semantically
`warning` — a user cannot complete their install without addressing them. Rendering them at
`info` severity means the envelope severity is never bumped to `warning` even when every row
is a warning, and the summary line will never show.

```typescript
// execute.ts:449-453 (current — no severity stamp)
const row: PluginUnavailableMessage = {
  status: "unavailable",
  name: o.plugin,
  reasons: [importWarningReason(o.reason)],
};
```

**Fix:**
```typescript
const row: PluginUnavailableMessage = {
  status: "unavailable",
  name: o.plugin,
  reasons: [importWarningReason(o.reason)],
  severity: "warning",
  needsReload: false,
};
```

Confirm that `PluginUnavailableMessage` accepts `severity` and `needsReload` (it extends
`MessageBase` which has them as optional fields).

---

### WR-03: `unexpectedPluginFailures` rows in import lack `cause` field

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:428-435`

**Issue:** `PluginFailedMessage` for `unexpectedPluginFailures` sets `reasons: ["not in manifest"]`
but omits `cause`. The import engine has the original error available on the result object
(the outer loop iterates `result.unexpectedPluginFailures`). Without `cause`, the renderer
cannot emit a diagnostic line, and the only user-visible information is the generic reason
token. Any unexpected failure involving a real exception (network error, parse error) will
silently discard its message.

**Fix:** Check whether `result.unexpectedPluginFailures` carries an error object and thread it:

```typescript
// If the result shape exposes an `error` or `cause` field:
const row: PluginFailedMessage = {
  status: "failed",
  name: o.plugin,
  reasons: ["not in manifest"] as const,
  ...(o.cause !== undefined && { cause: o.cause }),
  severity: "error",
  needsReload: false,
};
```

If the result type does not carry an error, this is still worth documenting in a comment so
the omission is explicit rather than accidental.

---

### WR-04: `narrowReasons([])` returns `[]`, yielding `PluginFailedMessage` with empty reasons

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:971-981`

**Issue:** `narrowReasons` at line 972 returns `[]` when `notes` is `undefined` or empty.
This empty array is then used to build `PluginFailedMessage.reasons`. The renderer for a
failed row with no reasons will produce `(failed)` with no bracketed reason list — a confusing
output for a user who sees a failure with no explanation.

This path is reachable in the bulk cascade arm of `outcomeToPluginMessage` when
`outcome.reasons` is `undefined` and `outcome.notes` is `undefined` or `[]` (line ~894-896):

```typescript
const reasons: readonly ContentReason[] = isManualRecoveryOutcome(outcome)
  ? (["rollback partial"] as const)
  : (outcome.reasons ?? narrowReasons(outcome.notes));  // Can return []
```

**Fix:** Guard against an empty reasons array by providing a fallback reason that is honest
about the unknown failure:

```typescript
const narrowed = outcome.reasons ?? narrowReasons(outcome.notes);
const reasons: readonly ContentReason[] =
  narrowed.length > 0 ? narrowed : (["unreadable"] as const);
```

`"unreadable"` is already in the `ContentReason` set per `ATTR-09 / D-47-B` (cited in the
`narrowReasons` JSDoc at line 963), so this is consistent with the established fallback policy.

---

## Info

### IN-01: Forbidden "Pitfall 5" reference in `composeTally` JSDoc

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:2430`

**Issue:** The JSDoc for `composeTally` contains:

> "Returns `""` when the tally must not render: the operation is single-target
> (cardinality !== "plural" -- D-04 / Pitfall 5, never a row-count heuristic)"

`Pitfall 5` is a bare `Pitfall N` reference — forbidden by the TypeScript comment policy.
Per-phase `Pitfall N` numbering restarts in each RESEARCH document, so the token is ambiguous.

**Fix:** Drop the reference; the surrounding D-04 anchor already provides the traceability:

```typescript
// Returns `""` when the tally must not render: the operation is single-target
// (cardinality !== "plural" -- D-04, never a row-count heuristic),
```

---

### IN-02: Two "Pitfall 7" references in `info.ts` violate comment policy

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:61` and `:446`

**Issue:** Lines 61 and 446 both contain `Pitfall 7` references:

- Line 61: `// SURF-01 / Pitfall 7: TOOL_EVENTS is a string[] tuple; rewrap as a Set`
- Line 446: `// SURF-01 / Pitfall 7: object-literal field placement is documentation`

Both are bare `Pitfall N` tokens — forbidden by the TypeScript comment policy. `SURF-01` alone
is a sufficient anchor.

**Fix:** Remove the `Pitfall 7` token from both comments, keeping the `SURF-01` anchor:

```typescript
// Line 61:
// SURF-01: TOOL_EVENTS is a string[] tuple; rewrap as a Set ...

// Line 446:
// SURF-01: object-literal field placement is documentation only ...
```

---

_Reviewed: 2026-06-25T00:54:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
