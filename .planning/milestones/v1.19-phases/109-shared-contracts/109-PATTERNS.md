# Phase 109: Shared Contracts - Pattern Map

**Mapped:** 2026-08-29
**Pairs analyzed:** 19
**Runtime analog coverage:** 19 / 19
**Compliant type-only analog coverage:** 0 / 4 type-evidence slices

## File Classification

Each row is one atomic source-owner pair. The production source changes only when its current public seam cannot give direct coverage.

| Pair    | New or Modified Owner                          | Conditional Source                                                   | Role           | Data Flow               | Closest Current Analog                                                      | Match Quality                             |
| ------- | ---------------------------------------------- | -------------------------------------------------------------------- | -------------- | ----------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| P109-01 | `tests/shared/atomic-json.test.ts`             | `extensions/pi-claude-marketplace/shared/atomic-json.ts`             | utility + test | file-I/O                | `tests/shared/atomic-json.test.ts:17-30`                                    | exact baseline                            |
| P109-02 | `tests/shared/completion-cache.test.ts`        | `extensions/pi-claude-marketplace/shared/completion-cache.ts`        | store + test   | CRUD, file-I/O          | `tests/shared/completion-cache.test.ts:28-35,71-88`                         | exact baseline with state correction      |
| P109-03 | `tests/shared/concerns/hooks.test.ts`          | `extensions/pi-claude-marketplace/shared/concerns/hooks.ts`          | utility + test | transform               | `tests/shared/notify-v2.test.ts:3696-3810`                                  | migration input                           |
| P109-04 | `tests/shared/concerns/soft-dep.test.ts`       | `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`       | utility + test | transform               | `tests/shared/notify-v2.test.ts:233-320`                                    | migration input                           |
| P109-05 | `tests/shared/debug-log.test.ts`               | `extensions/pi-claude-marketplace/shared/debug-log.ts`               | utility + test | event-driven            | `tests/shared/debug-log.test.ts:19-52`                                      | exact baseline with lifecycle correction  |
| P109-06 | `tests/shared/errors-bridges.test.ts`          | `extensions/pi-claude-marketplace/shared/errors-bridges.ts`          | model + test   | transform               | `tests/shared/errors-bridges.test.ts:14-89`                                 | exact baseline                            |
| P109-07 | `tests/shared/errors.test.ts`                  | `extensions/pi-claude-marketplace/shared/errors.ts`                  | model + test   | transform               | `tests/shared/errors-bridges.test.ts:20-83`                                 | role and flow match                       |
| P109-08 | `tests/shared/extension-version.test.ts`       | `extensions/pi-claude-marketplace/shared/extension-version.ts`       | config + test  | request-response        | `tests/shared/completion-cache.test.ts:41-64`                               | exact-literal pattern                     |
| P109-09 | `tests/shared/fs-utils.test.ts`                | `extensions/pi-claude-marketplace/shared/fs-utils.ts`                | utility + test | file-I/O                | `tests/shared/atomic-json.test.ts:17-68`                                    | role and flow match                       |
| P109-10 | `tests/shared/git-failure-classifiers.test.ts` | `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` | utility + test | transform               | `tests/shared/probe-classifiers.test.ts:195-253`                            | exact flow match                          |
| P109-11 | `tests/shared/markers.test.ts`                 | `extensions/pi-claude-marketplace/shared/markers.ts`                 | config + test  | request-response        | `tests/shared/completion-cache.test.ts:41-64`                               | exact-literal pattern                     |
| P109-12 | `tests/shared/notify-context.test.ts`          | `extensions/pi-claude-marketplace/shared/notify-context.ts`          | service + test | event-driven            | `tests/shared/notify-context-dispatch-guard.test.ts:32-115`                 | migration input with ownership correction |
| P109-13 | `tests/shared/notify-reasons.test.ts`          | `extensions/pi-claude-marketplace/shared/notify-reasons.ts`          | utility + test | transform               | `tests/shared/probe-classifiers.test.ts:32-189`                             | exact flow match                          |
| P109-14 | `tests/shared/notify.test.ts`                  | `extensions/pi-claude-marketplace/shared/notify.ts`                  | service + test | event-driven            | `tests/shared/notify-v2.test.ts:204-230,3734-3808`                          | exact rendering migration input           |
| P109-15 | `tests/shared/path-safety.test.ts`             | `extensions/pi-claude-marketplace/shared/path-safety.ts`             | utility + test | file-I/O                | `tests/shared/atomic-json.test.ts:17-68`                                    | role and flow match                       |
| P109-16 | `tests/shared/probe-classifiers.test.ts`       | `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`       | utility + test | transform               | `tests/shared/probe-classifiers.test.ts:32-253`                             | exact baseline                            |
| P109-17 | `tests/shared/session-env.test.ts`             | `extensions/pi-claude-marketplace/shared/session-env.ts`             | utility + test | transform, event-driven | `tests/shared/debug-log.test.ts:19-52`                                      | state-boundary match                      |
| P109-18 | `tests/shared/types.test.ts`                   | `extensions/pi-claude-marketplace/shared/types.ts`                   | model + test   | transform               | `tests/shared/completion-cache.test.ts:41-64`; `109-RESEARCH.md`, Pattern 3 | runtime match, type-only fallback         |
| P109-19 | `tests/shared/vars.test.ts`                    | `extensions/pi-claude-marketplace/shared/vars.ts`                    | utility + test | transform               | `tests/shared/probe-classifiers.test.ts:32-189`                             | exact flow match                          |

## Pattern Assignments

### P109-01: `atomic-json.ts` and `atomic-json.test.ts`

**Analog:** `tests/shared/atomic-json.test.ts:17-30`

Keep the real temporary directory and exact UTF-8 byte assertion. Normalize each case to the lowercase runtime phases.

Pin `JSON.stringify(value, null, 2) + "\n"`, parent creation, and complete concurrent-write documents. Do not derive the expected bytes from production code.

### P109-02: `completion-cache.ts` and `completion-cache.test.ts`

**Analog:** `tests/shared/completion-cache.test.ts:28-35,71-88,472-563`

Keep the real temporary directory pattern and public cache calls. Replace shared reset-at-case-start behavior with unique keys and narrow public invalidation.

Cover schema acceptance and rejection, memory and disk reads, injected time, TTL boundaries, poison caching, JSON parse failure, and three invalidation paths.

Use `resetCompletionCache()` in one dedicated contract case only. Do not use it as setup, and do not add another reset seam.

### P109-03: `concerns/hooks.ts` and `concerns/hooks.test.ts`

**Analog:** `tests/shared/notify-v2.test.ts:3696-3810`

Move the pure hook block cases into this owner. Cover undefined, empty, strict tool, strict non-tool, lenient supported, and lenient unsupported entries.

The legacy type case wraps compile-time evidence in `test()`. Do not copy that wrapper. Use the module-scope type-only pattern in Shared Patterns.

Retain exact indentation literals from `concerns/hooks.ts:109-128`. Leave only full `notify.ts` integration bytes in P109-14.

### P109-04: `concerns/soft-dep.ts` and `concerns/soft-dep.test.ts`

**Analog:** `tests/shared/notify-v2.test.ts:233-320`

Move pure dependency selection from the legacy output cases. Use named rows for the Boolean truth table.

Assert the exact values `requires pi-subagents` and `requires pi-mcp`. Assert agents before MCP when both markers apply.

Add module-scope evidence for `Dependency = "agents" | "mcp"`. P109-14 owns only the bytes that render already-selected markers.

### P109-05: `debug-log.ts` and `debug-log.test.ts`

**Analog:** `tests/shared/debug-log.test.ts:19-52`

Keep the exact gate and exact console bytes. Use the current test context for `t.mock.method(console, "error")`.

Register restoration before the case changes `PI_CLAUDE_MARKETPLACE_DEBUG`. Each generated near-match value must create a sibling `test()` case.

Cover the default `hooks` tag, a custom tag, and silence for every value except the exact string `"1"`.

### P109-06: `errors-bridges.ts` and `errors-bridges.test.ts`

**Analog:** `tests/shared/errors-bridges.test.ts:14-89`

Keep direct constructor calls and public-field assertions. Upgrade message fragments to exact full messages and complete structured values.

Add `CommandNameError` from `errors-bridges.ts:117-121`. Cover inheritance, name, fields, cause, frozen collections, and defensive copies.

### P109-07: `errors.ts` and `errors.test.ts`

**Analog:** `tests/shared/errors-bridges.test.ts:20-83`

Use one behavior case per exported helper or class arm. Compare complete objects, arrays, names, messages, causes, trailers, and discriminators.

Exercise defensive aliasing by mutating the caller input after construction. Exercise frozen copies with `Object.isFrozen` and exact retained values.

Enumerate every union arm before using focused coverage. Do not add cases only to change a coverage counter.

### P109-08: `extension-version.ts` and `extension-version.test.ts`

**Analog:** `tests/shared/completion-cache.test.ts:41-64`

Create one direct owner case. Import `EXTENSION_VERSION` and assert the independent literal `"0.17.0"`.

Keep `tests/architecture/extension-version-sync.test.ts` as a supplemental drift guard. It does not replace this owner.

### P109-09: `fs-utils.ts` and `fs-utils.test.ts`

**Analog:** `tests/shared/atomic-json.test.ts:17-68`

Use a fresh real temporary directory in every filesystem case. Assert complete paths, arrays, error values, file bytes, and reverse rollback order.

Cover path existence, cleanup, orphan removal, rollback leaks, materialization variants, tolerant reads, and markdown filtering.

Remove `t.skip` and permission-mode assumptions. Use current-context method substitution only for deterministic exceptional Node API branches.

### P109-10: `git-failure-classifiers.ts` and `git-failure-classifiers.test.ts`

**Analog:** `tests/shared/probe-classifiers.test.ts:195-253`

Convert the existing cases to named rows. Cover HTTP status, cancellation, errno, cause chains, non-Error inputs, and negative cases.

Each expected result must be one exact literal: `network unreachable`, `authentication required`, or `undefined`.

### P109-11: `markers.ts` and `markers.test.ts`

**Analog:** `tests/shared/completion-cache.test.ts:41-64`

Create direct owner cases for both constants. Assert the complete independent literals, including spaces and capitalization.

Retain architecture marker snapshots as supplemental drift guards.

### P109-12: `notify-context.ts` and `notify-context.test.ts`

**Migration input:** `tests/shared/notify-context-dispatch-guard.test.ts:32-115`

The legacy suite proves fallback and tally behavior, but it imports `INSTALL_CONTEXT`. Do not copy that production renderer dependency.

Build a local typed `CommandContext` with controlled renderer functions. Assert renderer selection, arguments, call count, label, cardinality, tally, no-op, and reconcile dispatch.

Cover all four public wrappers and the missing-arm fallback. Assert dispatch effects through sentinels or strict interactions, not central renderer byte matrices.

Split dispatch portions from the two legacy reason suites into this owner. P109-14 receives only their distinct exact-rendering contracts.

### P109-13: `notify-reasons.ts` and `notify-reasons.test.ts`

**Analog:** `tests/shared/probe-classifiers.test.ts:32-189`

Use named pure row matrices. Cover idempotent reasons, skip severity, companion severity, failure classification, malformed-kind mapping, and ordering.

Add module-scope completeness evidence. Do not repeat this truth table in `notify.test.ts`.

### P109-14: `notify.ts` and `notify.test.ts`

**Migration input:** `tests/shared/notify-v2.test.ts:204-230,3734-3808`

The existing exact-byte assertion at lines 228-230 is the core pattern. Convert the output catalog into named data rows grouped by public status.

Every row must contain a complete literal expected byte string. Do not build expected values with production icons, reasons, constants, or formatters.

Cover every public renderer, helper, and entry point. Include severity, reload reductions, descriptions, indentation, causes, summaries, cascades, fallbacks, and diagnostics.

P109-14 depends on P109-03, P109-04, P109-12, and P109-13. Delete all seven absorbed legacy suites only in this pair's commit.

### P109-15: `path-safety.ts` and `path-safety.test.ts`

**Analog:** `tests/shared/atomic-json.test.ts:17-68`

Use real temporary paths for contained, parent, self, outside, and symlink cases. Assert exact error classes, fields, and messages.

Cover unexpected `lstat` propagation and unreadable `readlink` fallback deterministically. Use `t.mock.method` on a current-context filesystem object if necessary.

If the filesystem import blocks substitution, make the smallest internal dependency-access refactor. Add no export, reset hook, state reader, or test mode.

### P109-16: `probe-classifiers.ts` and `probe-classifiers.test.ts`

**Analog:** `tests/shared/probe-classifiers.test.ts:32-253`

Keep the direct source import and exact reason values. Convert repetitive branches to named rows with sibling cases and lowercase phases.

Preserve prefix ordering, deduplication, cause walking, exact notes, and negative cases. Remove migration and work-session commentary from case names.

### P109-17: `session-env.ts` and `session-env.test.ts`

**Analog:** `tests/shared/debug-log.test.ts:19-52`

Keep pure projection separate from live environment mutation. Register restoration before the case changes any process environment key.

Assert the exact session triple and `PI_CLAUDE_MARKETPLACE_PATH`. Use named rows for removal, deduplication, ordering, and tamper behavior.

### P109-18: `types.ts` and `types.test.ts`

**Analog:** No compliant current codebase analog. Use `109-RESEARCH.md`, Pattern 3.

Use a normal runtime case for `SCOPES`, with the exact array `["user", "project"]`.

Put positive `satisfies` and negative `@ts-expect-error` evidence at module scope. Reject `"local"` without a fake runtime case or phase comments.

### P109-19: `vars.ts` and `vars.test.ts`

**Analog:** `tests/shared/probe-classifiers.test.ts:32-189`

Use named transform rows for all four tokens, absent optional values, unknown tokens, repeated tokens, and single-pass replacement.

Expected strings must be independent literals. Restore process environment in the same case when an integration-style row changes it.

## Shared Patterns

### Exact lowercase runtime phases

**Source:** `109-RESEARCH.md`, Architecture Pattern 2
**Apply to:** Every runtime case created or modified in all 19 owners

```typescript
for (const { name, input, expected } of rows) {
  test(name, () => {
    // arrange
    const expectedValue = expected;

    // act
    const actualValue = classify(input);

    // assert
    assert.deepStrictEqual(actualValue, expectedValue);
  });
}
```

Use exact lowercase `// arrange`, `// act`, and `// assert` comments in that order. Keep the shown blank lines.

Use `// act & assert` only when one `assert.throws()` or `assert.rejects()` expression is the complete act and assertion.

### Type-only evidence

**Source:** `109-RESEARCH.md`, Architecture Pattern 3
**Apply to:** P109-03, P109-04, P109-13, and P109-18

```typescript
declare const acceptedScope: Scope;
void (acceptedScope satisfies Scope);

// @ts-expect-error local is intentionally not a Scope
void ("local" satisfies Scope);
```

Keep these expressions at module scope. Add no `test()` wrapper, phase comments, or artificial runtime assertion.

### Case-owned process state

**Source:** `tests/shared/debug-log.test.ts:19-52`, adapted to D-04
**Apply to:** P109-05, P109-17, and environment-sensitive P109-19 cases

```typescript
test("emits the exact debug message under the exact gate", (t) => {
  // arrange
  const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previous === undefined) delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    else process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
  });
  const consoleError = t.mock.method(console, "error");
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";

  // act
  hookDebugLog("sample detail");

  // assert
  assert.deepStrictEqual(consoleError.mock.calls[0]?.arguments, ["[hooks] sample detail"]);
});
```

Register cleanup before the mutation. The same case must restore every environment, console, notification, timer, and mock change.

### Case-owned filesystem and cache

**Source:** `tests/shared/atomic-json.test.ts:17-30` and `tests/shared/completion-cache.test.ts:28-35`
**Apply to:** P109-01, P109-02, P109-09, and P109-15

```typescript
test("writes the complete JSON document", async (t) => {
  // arrange
  const dir = await mkdtemp(path.join(os.tmpdir(), "shared-contract-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "nested", "out.json");
  const expectedBytes = '{\n  "ok": true\n}\n';

  // act
  await atomicWriteJson(file, { ok: true });

  // assert
  assert.strictEqual(await readFile(file, "utf8"), expectedBytes);
});
```

Use a new directory for every case. Cache cases also use unique scope and marketplace keys plus the current public invalidation methods.

### Complete error values

**Source:** `tests/shared/errors-bridges.test.ts:20-83`, strengthened for exact-value requirements
**Apply to:** P109-06, P109-07, P109-09, and P109-15

```typescript
// arrange
const error = new McpServerCollisionError("acme-server", "/scope/mcp.json");
const expected = {
  name: "McpServerCollisionError",
  message: 'Refusing to stage MCP server "acme-server": already exists in /scope/mcp.json.',
  serverName: "acme-server",
  owningPath: "/scope/mcp.json",
};

// act
const actual = {
  name: error.name,
  message: error.message,
  serverName: error.serverName,
  owningPath: error.owningPath,
};

// assert
assert.deepStrictEqual(actual, expected);
```

Do not use regular expressions for stable message fragments. Compare the complete public value to independent expected data.

### Notification ownership

**Sources:** `tests/shared/notify-context-dispatch-guard.test.ts:32-115` and `tests/shared/notify-v2.test.ts:204-230`
**Apply to:** P109-03, P109-04, P109-12, P109-13, and P109-14

```text
hooks.test.ts             owns hook types and pure hook block formatting
soft-dep.test.ts          owns dependency selection and marker order
notify-reasons.test.ts    owns reason and severity selection
notify-context.test.ts    owns wrapper projection and controlled renderer dispatch
notify.test.ts            owns exact final bytes and notification severity
```

Do not keep a cross-module supplemental copy. A failure must point to the module that owns the public contract.

## Notification Consolidation Boundaries

| Legacy Suite                                         | New Owner                     | Required Move                                                                                                                       |
| ---------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `tests/shared/notify-context-dispatch-guard.test.ts` | P109-12                       | Move controlled dispatch and fallback behavior. Replace `INSTALL_CONTEXT` with local controlled renderers. Delete the legacy suite. |
| `tests/shared/notify-disabled-reasons.test.ts`       | P109-12 and P109-14           | Move dispatch effects to P109-12. Move distinct full output bytes to P109-14. Delete the legacy suite.                              |
| `tests/shared/notify-not-installed-reasons.test.ts`  | P109-12 and P109-14           | Apply the same split. Keep no duplicate cross-module case. Delete the legacy suite.                                                 |
| `tests/shared/notify-inert-fields.test.ts`           | P109-14                       | Keep distinct byte and inert-field contracts only. Delete duplicates and the legacy suite.                                          |
| `tests/shared/notify-v2.test.ts`                     | P109-03, P109-04, and P109-14 | Move pure concern evidence first. Move distinct output rows to P109-14. Delete the legacy suite.                                    |
| `tests/shared/snm37-behavioral-smoke.test.ts`        | P109-14                       | Keep distinct public grammar behavior. Delete historical packaging and the legacy suite.                                            |
| `tests/shared/snm38-indent-ladder.test.ts`           | P109-14                       | Keep exact indentation bytes in owner rows. Delete the legacy suite.                                                                |

Use a case-level migration ledger in the P109-14 plan. Mark each legacy case as `move`, `split`, or `duplicate` before deletion.

Architecture catalog and grammar suites remain supplemental. Do not delete them as part of this consolidation.

## Pair-Atomic Source-Change Boundaries

1. Each P109 plan owns one named production source and its mirrored owner test.
2. Modify a production source only when its public seam cannot provide direct 100 percent function, line, and branch coverage.
3. Keep every behavior-preserving production refactor inside its source-owner pair commit.
4. Add no public test export, reset hook, state reader, test mode, private-member access, or coverage ignore.
5. P109-14 alone can delete the seven mapped legacy notification suites.
6. P109-14 must start only after P109-03, P109-04, P109-12, and P109-13 pass focused validation.
7. Run the focused owner test and focused direct coverage command before each pair commit.

The source boundary is strict. A plan for one pair must not normalize, refactor, or fix another pair.

## No Analog Found

The codebase has no current compliant module-scope pattern for the Phase 109 type-only evidence.

| Evidence Slice                               | Role | Data Flow | Required Fallback                                                                                   |
| -------------------------------------------- | ---- | --------- | --------------------------------------------------------------------------------------------------- |
| `concerns/hooks.test.ts` closed unions       | test | transform | Use `109-RESEARCH.md`, Pattern 3. Do not copy the runtime wrapper at `notify-v2.test.ts:3696-3732`. |
| `concerns/soft-dep.test.ts` dependency union | test | transform | Use positive `satisfies` and negative `@ts-expect-error` at module scope.                           |
| `notify-reasons.test.ts` completeness        | test | transform | Use module-scope exhaustive evidence with no fake runtime case.                                     |
| `types.test.ts` scope union                  | test | transform | Use the exact research example and reject `"local"`.                                                |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/`, `tests/shared/`, and mapped legacy notification suites

**Primary analog archetypes:** 5

**Migration inputs:** 7 legacy notification suites

**Search method:** CodeGraph first, followed by targeted line reads for files that CodeGraph did not surface

**Pattern extraction date:** 2026-08-29
