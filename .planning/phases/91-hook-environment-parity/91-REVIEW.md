---
phase: 91-hook-environment-parity
reviewed: 2026-08-03T15:24:07Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - tests/architecture/hooks-async-rewake.test.ts
  - tests/bridges/hooks/dispatch-exec.test.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 91: Code Review Report

**Reviewed:** 2026-08-03T15:24:07Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The phase adds Claude-Code-parity session env vars — `CLAUDECODE="1"`,
`CLAUDE_CODE_SESSION_ID`, and the pi-only alias `CLAUDE_SESSION_ID` (D-91-02) —
to both hook-spawn lanes (`prepareEnv` in `dispatch-exec.ts` and
`prepareAsyncEnv` in `async-rewake/registry.ts`), plus a D-91-01 behavioral
drift-guard test that compares the two lanes' child envs modulo `MARKER_ENV`.

The change is additive and low-risk. The session-id value flows from
`transCtx.sessionId`, typed `string` (peer-dep `getSessionId(): string`), so the
new keys cannot be `undefined` under the contract; env values are passed via the
spawn `env` array and are not shell-interpreted, so there is no injection or
crash path. The keys are placed after the `...process.env` spread in both lanes,
so the per-dispatch snapshot wins (D-91-02), and a dedicated test pins that
override. The drift-guard test (`assertLaneParity`) compares full key SETs plus
per-key values, which is a genuinely strong guard against the two lanes drifting.

No BLOCKER-class defect (crash, injection, data loss, auth bypass) was found in
the diff. Findings below are maintainability/robustness concerns.

## Warnings

### WR-01: Session-env contract duplicated verbatim across two spawn sites

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:321-323`
and `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:618-620`

**Issue:** The three-key session-env block (`CLAUDECODE`,
`CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`) is now duplicated verbatim in two
functions, on top of the already-duplicated `CLAUDE_PROJECT_DIR` /
`CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` / `CLAUDE_ENV_FILE` block
(`prepareAsyncEnv`'s own docstring calls itself a "Copy of
`dispatch-exec.ts:prepareEnv`"). The whole point of the phase is env parity
between the lanes, so any future edit to one env block that misses the other
silently breaks that parity. This is exactly the failure mode the phase exists
to prevent.

**Mitigation present:** The D-91-01 drift-guard test
(`tests/architecture/hooks-async-rewake.test.ts:1382-1453`) compares the two
lanes' full env key sets and per-key values, so a divergence is caught in CI.
This meaningfully reduces the risk — hence WARNING, not BLOCKER — but a shared
helper would make the contract un-drift-able by construction rather than
by-test.

**Fix:** Extract the shared env construction into a single helper both lanes
call (the async lane then layers `[MARKER_ENV]: dispatchId` on top), e.g.:

```ts
// shared/hook-env.ts
export async function buildBaseHookEnv(
  entry: RoutingEntry,
  transCtx: TranslationContext,
  loc: ScopedLocations,
): Promise<NodeJS.ProcessEnv> {
  const pluginData = path.join(loc.dataRoot, entry.pluginId);
  await assertPathInside(loc.dataRoot, pluginData, "CLAUDE_PLUGIN_DATA");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: transCtx.cwd,
    CLAUDE_PLUGIN_ROOT: entry.resolvedSource,
    CLAUDE_PLUGIN_DATA: pluginData,
    CLAUDECODE: "1",
    CLAUDE_CODE_SESSION_ID: transCtx.sessionId,
    CLAUDE_SESSION_ID: transCtx.sessionId,
  };
  if (entry.claudeEvent === "SessionStart") {
    const envFile = path.join(loc.dataRoot, "_shared", `claude-env-${transCtx.sessionId}.env`);
    await assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE");
    env.CLAUDE_ENV_FILE = envFile;
  }
  return env;
}
```

The existing `prepareAsyncEnv` docstring already flags this as a deferred
"v1.14+ lockstep-helper extraction" — this finding records that the duplication
is now load-bearing (parity is a shipped requirement, not incidental) and the
extraction is worth doing sooner.

### WR-02: `CLAUDECODE="1"` asserts Claude-Code identity but inherited `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are not scrubbed

**File:** `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:312-324`
and `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:609-621`

**Issue:** Both env blocks spread `...process.env` and then set `CLAUDECODE="1"`.
Hook scripts conventionally treat `CLAUDECODE` as the "am I running under Claude
Code" flag and then read companion vars such as `CLAUDE_CODE_ENTRYPOINT`,
`CLAUDE_CODE_SSE_PORT`, `CLAUDE_CODE_REMOTE`, or `ANTHROPIC_*`. If Pi is itself
launched from inside a real Claude Code session, those companion vars are present
in `process.env` and pass straight through the spread. Only
`CLAUDE_CODE_SESSION_ID` is overridden to Pi's snapshot; the others still carry
the *parent* Claude session's values. A hook then sees `CLAUDECODE=1` +
Pi's session id + the parent's entrypoint/remote/port — an inconsistent,
partially-stale Claude identity. Note the code explicitly documents
`CLAUDE_CODE_REMOTE` as "intentionally NOT set (Pi runs locally)", yet an
inherited `CLAUDE_CODE_REMOTE=1` from the spread would silently defeat that
contract.

**Confidence / precondition:** Conditional — only manifests when Pi runs nested
inside a real Claude Code process (plausible for developers). By-design env
inheritance is intentional, so this is a WARNING to document/decide, not a proven
defect in the common case.

**Fix:** Either (a) explicitly reset the small closed set of Claude-Code
companion vars the parity contract does not intend to forward (e.g.
`CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT`) to
`undefined` after the spread so spawn drops them, mirroring the deliberate
`CLAUDE_CODE_REMOTE` stance already narrated in the header comment; or (b) record
an explicit decision that inheriting the parent Claude env is intended, so the
"intentionally NOT set" comment for `CLAUDE_CODE_REMOTE` is not contradicted by
the spread.

## Info

### IN-01: Drift-guard test exercises 2 of 10 dispatchable events

**File:** `tests/architecture/hooks-async-rewake.test.ts:1408-1452`

**Issue:** `assertLaneParity` runs only for `PreToolUse` and `SessionStart`.
This is adequate today because env construction branches on event type in exactly
one place (the `SessionStart`-only `CLAUDE_ENV_FILE` arm), and the two chosen
events cover both sides of that branch. If a future change makes env construction
branch on additional events, the guard would silently miss lanes for the
uncovered events.

**Fix:** No change required now. Optionally add a short comment in the test noting
*why* two events suffice (only `SessionStart` branches), so a future author adding
an event-specific env key knows to extend the parity cases.

---

_Reviewed: 2026-08-03T15:24:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
