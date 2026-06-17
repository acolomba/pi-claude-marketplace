---
status: gaps_found
previous_status: "passed"
phase: 63-lifecycle-cascade-user-facing-surface-docs
source:
  - 63-01-SUMMARY.md
  - 63-02-SUMMARY.md
  - 63-03-SUMMARY.md
  - 63-04-SUMMARY.md
  - 63-05-SUMMARY.md
  - 63-06-SUMMARY.md
  - 63-07-SUMMARY.md
  - 63-08-SUMMARY.md
  - 63-09-SUMMARY.md
  - 63-10-SUMMARY.md
  - 63-11-SUMMARY.md
started: 2026-06-16T18:23:24Z
updated: 2026-06-17T09:30:00Z
---

## Current Test

[testing complete -- test 8 gap closed by debug session hooks-only-list-disabled; operator runtime-verified 2026-06-17T01:45Z]

## Tests

### 1. Cold-start smoke against the pi-uat sandbox
expected: |
  Kill any running pi process. From the repo root:

      scripts/pi.sh --clear --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat

  Then in the Pi REPL run `/reload` once and `/claude:plugin list`. The
  process boots without errors, the marketplace `claude-plugins-official`
  is listed, and `commit-commands@claude-plugins-official` appears with an
  `(installed)` status. No stack traces, no notify Error: rows.
result: pass

### 2. `npm run check` regression sweep is GREEN
expected: |
  From the repo root, run `npm run check`. Typecheck + ESLint + Prettier
  format check + unit tests + integration tests all pass. Baseline is
  2273 unit + 10 integration + 1 skipped (per 63-08-SUMMARY.md and the
  verifier's spot-check). No cross-file regressions from the 8 plan-commits
  in phase 63.
why_human: |
  Verifier could only spot-check individual test files. A full sweep gives
  independent confirmation that the 12 files modified across plans 63-01..08
  did not introduce a cross-file regression elsewhere in the suite.
result: pass

### 3. Install a hooks-declaring plugin produces (installed) row + on-disk hooks.json + reload hint
expected: |
  In the Pi REPL launched by `scripts/pi.sh --home tmp/pi-uat`:

      /claude:plugin install hookify@claude-plugins-official

  Expected user-observable output:
    • A `+ hookify@claude-plugins-official [user] (installed)` row in the
      cascade.
    • A `Run /reload to activate hookify@claude-plugins-official.` trailer
      (or the v1.4 equivalent reload-hint sentence).
    • No notify Error: / Warning: rows.

  Then from a separate shell, verify the bridge wrote the hook config to
  disk under the user scope:

      ls tmp/pi-uat/agent/pi-claude-marketplace/hooks/hookify/
      head -20 tmp/pi-uat/agent/pi-claude-marketplace/hooks/hookify/hooks.json

  The `hooks.json` file exists, is a valid JSON object with top-level event
  keys (`PreToolUse`, `PostToolUse`, `Stop`, etc.), and its bytes match
  the source under
  `tmp/pi-uat/agent/pi-claude-marketplace/sources/.../hookify/hooks/hooks.json`
  that the resolver re-read.
result: blocked
evidence: |
  After plans 63-09 (wrapper-format fix) + 63-10 (cross-surface classifier
  parity) landed, the runtime UAT against the pi-uat sandbox produced:

      ● claude-plugins-official [user]
        ⊘ hookify (unavailable) {unsupported hooks}

  - No notify Error: / Warning: rows.
  - Cross-surface classification is now consistent: both `info` and the
    install cascade emit `(unavailable) {unsupported hooks}` for the same
    plugin (the 63-10 parity arm landed correctly).
  - On-disk: tmp/pi-uat/agent/pi-claude-marketplace/hooks/hookify/ was
    NOT written -- the resolver flipped `installable: false` before the
    install cascade reached the hooks-bridge slot.

  Verdict: the wrapper-format wire-contract bug is closed (63-09), and the
  cross-surface classifier asymmetry is closed (63-10). The residual
  `(unavailable) {unsupported hooks}` trip is honest v1.13 scope: hookify's
  upstream wire bytes (verified at
  tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/hooks/hooks.json)
  declare `Stop`, which is NOT a member of v1.13's BUCKET_A_EVENTS
  (extensions/pi-claude-marketplace/domain/components/hook-events.ts:37).
  `checkMatcherSupportability` correctly trips `(c) non-bucket-A event: Stop`.
reason: |
  Stop-event admission to BUCKET_A_EVENTS is deferred to v1.14+ per
  63-09-SUMMARY.md "Deferred" section (Option A taken at the user-decided
  checkpoint in 63-09). This is by-design v1.13 scope, not a defect. The
  binding wrapper fix (63-09) and cross-surface parity fix (63-10) both
  land correctly; the residual trip is structural.
closed_by: ["63-09", "63-10"]
deferred_to: "v1.14+ (Stop-event admission to BUCKET_A_EVENTS)"
reported_pre_fix: |
  failed:

      ● claude-plugins-official [user] <autoupdate>
        ⊘ hookify (unavailable) {unsupported hooks}
          Easily create custom hooks to prevent unwanted behaviors by
          analyzing conversation patterns or from explicit instructions.
          Define rules via simple markdown files.
          components: not resolved

       Error: 1 marketplace operation failed.

       ⊘ claude-plugin-official [user] (failed) {not added}

  several things wrong:

  1. doing an info on the plugin reports it as unavailable
  2. the marketplace is added, but when i go to install the plugin,
     the error indicates that the marketplace is not added

  [user clarified: observation 2 was caused by a typo in the install
  command (`claude-plugin-official` vs `claude-plugins-official`).
  After fixing the typo, the install cascade reports:]

      ● claude-plugins-official [user]
        ⊘ hookify (unavailable) {unsupported source}

  note that the reason is different than what was given in the plugin
  info output, and they should be the same
severity: blocker

### 4. `info <plugin>` for the installed hookify plugin renders a multi-line hooks: block in the alphabetical slot
expected: |
  In the Pi REPL:

      /claude:plugin info hookify@claude-plugins-official

  Expected: a `components:` block in alphabetical order

      components:
        agents: ...
        commands: ...
        hooks:
          PreToolUse(...)
          PostToolUse(...)
          Stop
          ...
        mcp: ...
        skills: ...

  Specifically: the `hooks:` header is at 4-space indent, sits between
  `commands:` and `mcp:` (alphabetical), each entry is at 6-space indent,
  tool events render as `<Event>(<matcher>)` and non-tool events
  (Stop, SessionStart, etc.) render as bare `<Event>` with no parentheses.
result: blocked
evidence: |
  Depends on test 3. After 63-09 + 63-10 landed, hookify still flips
  `(unavailable) {unsupported hooks}` via the bucket-A supportability gate
  (Stop arm not in BUCKET_A_EVENTS -- v1.14+ scope per 63-09 Option A).
  Hookify never reaches `(installed)` state, so `/claude:plugin info
  hookify@claude-plugins-official` correctly falls through to the
  `components: not resolved` rendering arm (matches Truth #4's
  "unavailable plugins continue to render components: not resolved"
  contract). The multi-line `hooks:` block contract this test was
  meant to exercise could not be validated because the precondition was
  not met.
reason: |
  Depends on test 3 -- hookify never reached installed state due to
  Stop-event admission being deferred to v1.14+ (63-09 Option A).
closed_by: ["63-09"]
deferred_to: "v1.14+ (Stop-event admission to BUCKET_A_EVENTS)"
reported_pre_fix: |
  fail:

      ● claude-plugins-official [user] <autoupdate>
        ⊘ hookify (unavailable) {unsupported hooks}
          Easily create custom hooks to prevent unwanted behaviors by
          analyzing conversation patterns or from explicit instructions.
          Define rules via simple markdown files.
          components: not resolved

  remember, this was not installed
severity: major
note: |
  Downstream of test 3 gap 1 — hookify never becomes installable, so
  `info` correctly falls through to the `components: not resolved`
  rendering arm (matches Truth #4's "unavailable plugins continue to
  render components: not resolved" contract). The contract this test
  was meant to exercise (multi-line `hooks:` block in the alphabetical
  slot between commands: and mcp:) could not be validated because the
  precondition was not met. No new gap; root cause is the resolver flip
  recorded against test 3.

### 5. Uninstall hookify removes the on-disk hook config and surfaces (uninstalled) + reload hint
expected: |
  In the Pi REPL:

      /claude:plugin uninstall hookify@claude-plugins-official

  Expected user-observable output:
    • A `- hookify@claude-plugins-official [user] (uninstalled)` row in the
      cascade.
    • A reload-hint trailer (`Run /reload to ...`).
    • No notify Error: / Warning: rows.

  Then verify the bridge removed the file from disk:

      ls tmp/pi-uat/agent/pi-claude-marketplace/hooks/hookify/

  Expected: directory is missing OR empty (idempotent rm per NFR-3). A
  subsequent re-uninstall would be a no-op (don't reboot — just confirm
  the disk state).
result: blocked
evidence: |
  Depends on test 3. After 63-09 + 63-10 landed, hookify still flips
  `(unavailable) {unsupported hooks}` via the bucket-A supportability gate
  (Stop arm not in BUCKET_A_EVENTS -- v1.14+ scope per 63-09 Option A).
  Hookify never reached `(installed)` state, so the uninstall path could
  not be exercised at runtime.
reason: |
  Depends on test 3 -- hookify never reached installed state due to
  Stop-event admission being deferred to v1.14+ (63-09 Option A).
closed_by: ["63-09"]
deferred_to: "v1.14+ (Stop-event admission to BUCKET_A_EVENTS)"
reported_pre_fix: "fail, because we never installed it"
severity: major
note: |
  Same downstream story as test 4: hookify never became installable due
  to test 3's gap, so the uninstall path could not be exercised. No new
  gap — root cause is the resolver flip recorded against test 3.

### 6. Symlink-escape inside a fake plugin's hooks/ is rejected at install with a notify error
expected: |
  Hand-build a tiny fake plugin source that buries a symbolic link inside
  its `hooks/` subtree pointing OUTSIDE the plugin root, wire it up as a
  path-source marketplace entry, then attempt to install it:

      # 1. seed the fake plugin source + an outside dir with a sentinel
      mkdir -p /tmp/63-uat/marketplace/hooks-escape-plugin/{.claude-plugin,hooks/sub}
      mkdir -p /tmp/63-uat/outside-target
      printf 'sentinel-do-not-read\n' > /tmp/63-uat/outside-target/SENTINEL
      printf '{}' > /tmp/63-uat/marketplace/hooks-escape-plugin/hooks/hooks.json
      ln -s /tmp/63-uat/outside-target \
            /tmp/63-uat/marketplace/hooks-escape-plugin/hooks/sub/escape
      cat > /tmp/63-uat/marketplace/hooks-escape-plugin/.claude-plugin/plugin.json <<'JSON'
      { "name": "hooks-escape-plugin", "version": "0.0.1" }
      JSON
      cat > /tmp/63-uat/marketplace/.claude-plugin/marketplace.json <<'JSON'
      { "name": "uat-symlink-fixture",
        "plugins": [
          { "name": "hooks-escape-plugin", "source": "./hooks-escape-plugin" }
        ] }
      JSON
      mkdir -p /tmp/63-uat/marketplace/.claude-plugin

  Then, from the Pi REPL launched against the pi-uat sandbox:

      /claude:plugin marketplace add /tmp/63-uat/marketplace
      /claude:plugin install hooks-escape-plugin@uat-symlink-fixture

  Expected: install is REJECTED. A notify Error: row mentions a "hooks
  subtree symlink" rejection and names the IN-TREE symlink path
  (`/tmp/63-uat/marketplace/hooks-escape-plugin/hooks/sub/escape`),
  NEVER the external path or the sentinel filename. The cascade halts
  at the hooks slot; prior-slot commits (skills/commands/agents)
  roll back. The on-disk
  `tmp/pi-uat/agent/pi-claude-marketplace/hooks/hooks-escape-plugin/hooks.json`
  was never written.
why_human: |
  This is the LIFE-03 + CR-01 walker-hardening contract from plan 63-08.
  Unit tests pin the assertion in-process; a runtime probe through the
  install orchestrator confirms the rejection surfaces through the existing
  v1.4 notify cascade with the correct subject.
result: pass
observed: |
  ● uat-symlink-fixture [user]
    ⊘ hooks-escape-plugin v0.0.1 (failed)
      cause: hooks subtree symlink /tmp/63-uat/marketplace/hooks-escape-plugin/hooks/sub/escape
             contains symlink /tmp/63-uat/marketplace/hooks-escape-plugin/hooks/sub/escape
             -> /tmp/63-uat/outside-target
             (parent: /tmp/63-uat/marketplace/hooks-escape-plugin,
              target: /tmp/63-uat/outside-target).
note: |
  Rejection subject is the IN-TREE symlink path; SENTINEL / DEEP_SENTINEL
  filenames seeded inside the external target do NOT appear in the
  message (walker provably never descended through the link). Minor
  wording oddity: "subtree symlink X contains symlink X -> Y" reads as if
  X contains itself; the duplicated path is awkward but not contract-
  breaking. Could be tightened in a follow-up but the LIFE-03 / CR-01
  contract is satisfied.

### 7. `docs/hooks.md` is reader-discoverable from README and covers the support story without internal jargon
expected: |
  Open the repository in a file viewer (or `less`):

      less README.md      # look for "## Hook support" section
      less docs/hooks.md  # the linked doc

  Expected: README has a `## Hook support` heading with one short
  paragraph and a markdown link `[Hook support reference](docs/hooks.md)`.
  Opening that link lands you on a 257-line plain-English doc that
  covers, in order: the 8 supported events (PreToolUse / PostToolUse /
  PostToolUseFailure / UserPromptSubmit / SessionStart / SessionEnd / Stop /
  Notification / SubagentStop / PreCompact — close to that wording),
  6 worked examples (auto-formatter, bash safety, session start, prompt
  audit, background security review, compaction snapshot), the Pi-to-Claude
  tool-name mapping table, a "what happens to my plugin?" decision tree,
  marketplace coverage (10/13), and a Further Reading section.

  No internal-jargon tokens (`bucket-A`, `REQ-`, `D-NN-NN`,
  `<lossy synthesis>`, `Pitfall`, `Pattern N`, `Phase`, `.planning/`,
  `RESEARCH.md`, `CONTEXT.md`) appear anywhere in the doc.
result: pass
note: |
  User flagged a follow-up: README's `## Features` section (line 21,
  bullet list of supported component kinds) lists Commands / Skills /
  Agents / MCP servers but omits Hooks even though v1.13 ships hook
  support. Recorded as a minor gap below (cosmetic / docs touch-up).

### 8. A hooks-only installed plugin renders `(installed)` -- not `(disabled)` -- on `/claude:plugin list`
expected: |
  Test added during post-code-review UAT re-run on 2026-06-16. Pick a
  plugin from `claude-plugins-official` whose only declared artefacts are
  hooks AND whose declared events are all v1.13 bucket-A (i.e. NOT `Stop`,
  `Notification`, `SubagentStop`). `learning-output-style` matches: it
  declares only `SessionStart` (bucket-A), its hooks/hooks.json uses the
  wrapped form, and the source tree contains no skills / commands / agents /
  mcp/ artefacts.

  In the Pi REPL launched against the pi-uat sandbox:

      /claude:plugin install learning-output-style@claude-plugins-official
      /claude:plugin list
      /reload
      /claude:plugin list

  Expected: the install cascade emits `+ learning-output-style@claude-plugins-official [user] (installed)`.
  Both list invocations (before and after /reload) render the plugin row
  with the `(installed)` status token, NOT `(disabled)`. The plugin is
  newly installed -- it was never disabled, and the renderer must not
  classify it as such.
why_human: |
  The unit suite covers `available` hooks-plugins (HOOK-01 in
  `tests/orchestrators/plugin/list.test.ts:1083`) but no test exercises
  an INSTALLED hooks-only plugin through the list renderer. The runtime
  probe is the only place this misclassification surfaces.
result: pass
runtime_verified: 2026-06-17T01:45:00Z
evidence: |
  After fix (commits dbad53f / 3639048 / d43b480 / b563ca7 / aae0e79),
  the operator re-ran the runtime probe against the pi-uat sandbox and
  confirmed both `/claude:plugin list` invocations (before and after
  `/reload`) now render the row as `(installed)`. UAT closed.

  Pre-fix evidence retained below for the record:

  After `/claude:plugin install learning-output-style@claude-plugins-official`,
  the install cascade prints `(installed)` correctly. State.json records the
  plugin as installable: true with `resources.hooks = ["learning-output-style"]`
  and every other resource array empty. But `/claude:plugin list`, both
  before and after `/reload`, renders the row with `(disabled)`.

  Confirmed state.json after the install (excerpt):

      "learning-output-style": {
        "version": "1.0.0",
        "resolvedSource": ".../sources/.../learning-output-style",
        "compatibility": { "installable": true, "supported": ["hooks"] },
        "resources": {
          "skills": [], "prompts": [], "agents": [], "mcpServers": [],
          "hooks": ["learning-output-style"]
        },
        "installedAt": "2026-06-16T23:52:35.798Z"
      }

  Root cause is the `isRecordedButDisabled` predicate at
  `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:275-285`
  which checks the four pre-phase-63 resource axes
  (skills/prompts/agents/mcpServers) all-empty + installable: true and
  returns true. The phase-63 hook bridge added `resources.hooks` to the
  state schema but did NOT extend this predicate. A hooks-only installed
  plugin therefore satisfies the predicate and `list.ts:255` routes it to
  the `(disabled)` arm.

  Same gap mirrored in two drift-twin copies of the predicate:
    - `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:958-968`
      (the IN-04 duplicate flagged by 63-REVIEW.md as a future cleanup)
    - `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:175-191`
      (`isCurrentlyDisabled` -- pinned to plan.ts by the T5 drift gate)

  Why the unit suite missed it:
    - T5 drift gate at `tests/orchestrators/reconcile/plan.test.ts:713`
      hard-codes a 4-axis `requiredAxes` list and is consistently wrong on
      all three predicate copies; the gate fires only when the copies
      DISAGREE textually, not when they agree wrongly.
    - T5 truth-table test at `tests/orchestrators/reconcile/plan.test.ts:671`
      exercises the (installable x populated) matrix over the same 4 axes
      -- never the hooks axis.
    - The list HOOK-01 test at `tests/orchestrators/plugin/list.test.ts:1083`
      pins an `available` (uninstalled) hooks-plugin, never an installed
      hooks-only plugin.
reason: |
  Phase 63's hook bridge added `resources.hooks` to the state schema (D-63-04 /
  COMPONENT_KINDS 5-tuple) but did not update the 4-axis empty-resources
  conjunction in `isRecordedButDisabled` / `isCurrentlyDisabled` /
  `update.ts::isRecordedButDisabled`. The predicate now over-classifies
  hooks-only installed plugins as "recorded but disabled" and the list
  renderer emits the wrong status token.
severity: blocker
note: |
  Logged on 2026-06-16T23:55Z post code-review fixes
  (REVIEW.md:02e0a5d, REVIEW-FIX.md:8eb3c16). The WR-02 / WR-03 try/catch
  wraps in install.ts / reinstall.ts are unrelated -- this is a read-side
  predicate gap, not a write-path issue. Routed to /gsd-debug.

  Fix landed 2026-06-17 as four atomic commits on
  features/v1.13-hook-bridge:

      dbad53f fix(63): add resources.hooks axis to recorded-but-disabled predicates
      3639048 fix(63): zero resources.hooks in disable + partial-cascade fold
      d43b480 test(63): cover hooks axis in drift gate, truth table, and list
      b563ca7 test(63): regression test for disable zeroing resources.hooks

  Scope expanded beyond the originally-reported three predicate edits to
  include two latent companion regressions with the same v1.13 root cause
  (runDisableBranch + applyPartialCascadeFold both omitted the hooks axis).
  `npm run check` green: 2282 passing + 1 skipped (up from 2280 + 1) +
  10 integration. The `pass-pending-runtime` result is contingent on the
  user re-running the runtime probe -- re-run
  `/claude:plugin install learning-output-style@claude-plugins-official` +
  `/claude:plugin list` + `/reload` + `/claude:plugin list` against the
  pi-uat sandbox to confirm both list invocations now render
  `(installed)`.

### 9. A hooks-only user-scope plugin's SessionStart handler fires at Pi launch
expected: |
  Test added on 2026-06-17 after the test-8 runtime UAT closed and a
  follow-on runtime probe surfaced a second, root-cause-independent
  dispatch-side bug: even with the read-side `(installed)` classification
  correct, the hook handler was never spawned at session_start. Confirms
  the cross-scope dispatch path end-to-end.

  Use the same `learning-output-style` plugin from test 8 (hooks-only,
  declares only `SessionStart`, source ships the wrapped form). In the
  Pi REPL launched against the pi-uat sandbox:

      /claude:plugin install learning-output-style@claude-plugins-official
      /reload

  Add a side-channel touch file at the top of the source handler so a
  successful dispatch leaves disk evidence:

      sed -i '1a echo "fired at $(date -Iseconds)" >> /tmp/learning-fired.log' \
        tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/learning-output-style/hooks-handlers/session-start.sh

  Then relaunch Pi (handler script is referenced via
  `${CLAUDE_PLUGIN_ROOT}`, no re-install needed):

      rm -f /tmp/learning-fired.log
      scripts/pi.sh --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat
      # quit immediately

  Expected: `/tmp/learning-fired.log` exists after the launch, carrying
  a single timestamped `fired at ...` line. This proves the SessionStart
  bucket in the routing table contained the user-scope plugin's entry
  when `session_start` emitted, i.e. the cross-scope routing-table wipe
  is gone.
why_human: |
  The unit + integration suite covers per-scope rebuild semantics and
  the cross-scope cache walk added in this fix (event-router.test.ts
  "sequential per-scope rebuild preserves entries across scopes" +
  "cross-scope cache walk includes BOTH scopes' entries"), but the
  end-to-end "did Pi actually spawn the handler" check requires a live
  Pi process emitting `session_start`. Only the runtime probe surfaces
  it.
result: pass-pending-runtime
evidence: |
  Fix landed 2026-06-17 as two atomic commits on
  features/v1.13-hook-bridge:

      6a28bc4 test(63): regression test for cross-scope routing-table wipe
      2dbbcbd fix(63): rebuild routing table from full cross-scope cache

  Diagnosed by an instrumented runtime trace (PI_CLAUDE_MARKETPLACE_DEBUG=1
  plus temporary hookDebugLog instrumentation in dispatch.ts /
  event-router.ts) captured by the operator on 2026-06-17T02:25Z:

      [hooks] rebuild: scope=user    cache-size=1 collected=1
      [hooks] rebuild: scope=user    bucket SessionStart -> 1 entries
      [hooks] rebuild: scope=project cache-size=1 collected=0
      [hooks] dispatch: composite handler fired for SessionStart
      [hooks] dispatch: SessionStart routing bucket has 0 entries

  Instrumentation reverted before the session opened. Root cause:
  `routingTable` in bridges/hooks/event-router.ts:125 is a single
  module-global Map, but `rebuildRoutingTables(state, loc)` was
  populating it from `collectPluginsInScope(state, loc.scope)` -- a
  per-scope filtered view. The registerHooksBridge boot loop walks
  [user, project] sequentially, so the empty project rebuild
  immediately overwrote the user-scope's SessionStart bucket with [].
  session_start fired before any later rebuild restored the entry, so
  dispatch saw an empty bucket.

  Fix switches `rebuildRoutingTables` to walk the entire
  `parsedConfigCache` (the cross-scope authoritative source already
  maintained by install / uninstall / update / reinstall + hydrate),
  and adds the matching `removePluginConfigFromCache` +
  `rebuildRoutingTables` calls to runDisableBranch so the cache-walk
  semantics do not regress when disabling a hooks plugin in-session.

  `npm run check` green: 2285 passing + 1 skipped (up from 2282 + 1) +
  10 integration. Two new regression tests pin the cross-scope walk;
  two existing tests updated to align with the new cache-as-source-of-
  truth contract (event-router.test.ts cross-plugin sort + empty-cache
  rebuild, plus the same architecture-level twin in
  hooks-dispatch.test.ts DISP-04).

  Pending runtime probe by the user to flip status from
  `pass-pending-runtime` to `pass`: install learning-output-style,
  add the touch-file probe to the source handler, relaunch Pi, and
  confirm `/tmp/learning-fired.log` exists with a single timestamped
  line.

### 10. SessionStart additionalContext injects into the agent turn's system prompt
expected: |
  Test added on 2026-06-17 after the test-9 routing-table fix closed
  the dispatch-side gap. With the SessionStart handler now firing
  end-to-end (sentinel touch-file proven by the operator on
  2026-06-17T08:17:47Z), the residual contract is whether the
  handler's `{hookSpecificOutput: {additionalContext: "..."}}` payload
  is actually injected into Pi's session prompt. The pre-fix bridge
  silently dropped the mutate arm at `event-adapters.ts:271`
  (`adaptObservationResult`'s SessionStart case had no logical
  drain point upstream).

  Use the same `learning-output-style` plugin from tests 8 and 9. In
  the Pi REPL launched against the pi-uat sandbox AFTER the fix
  lands:

      scripts/pi.sh --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat
      # Plugin is already installed from tests 8 / 9; no re-install needed.
      # In the Pi REPL:
      write me a simple in-memory rate limiter for an HTTP API

  Expected: Pi exhibits the `learning-mode` behavior the plugin's
  prompt is supposed to inject. Specifically:
    • A `★ Insight ──────` box (or similar learning-mode framing)
      precedes design-decision discussion (e.g. the choice of
      token-bucket vs leaky-bucket vs fixed-window).
    • Pi PAUSES to request a 5-10 line user code contribution at the
      algorithm-choice / data-structure-choice decision point, rather
      than implementing straight through.
    • Or, at minimum, Pi's response mentions "learning mode" or
      acknowledges the contribution-request pattern -- i.e. the
      additionalContext is reaching the model's first agent turn.

  Pre-fix evidence (operator probe at 2026-06-17T08:30Z): NONE of
  the above markers appeared. Pi implemented the rate limiter
  straight through -- identical to the plugin-uninstalled baseline.
why_human: |
  The unit suite (session-start-additional-context.test.ts, 12
  tests) and the integration suite (hooks-additionalcontext-end-to-end
  .test.ts, 2 tests covering HOOK-E2E-03 and HOOK-E2E-04) pin the
  buffer-append + drain + reload-clears contract at the seam level.
  The end-to-end "did the model actually see the injected context"
  check requires a live Pi process emitting before_agent_start with
  Pi's real systemPrompt as the base and a real LLM observing the
  joined prompt. Only the runtime probe can confirm the user-visible
  effect.
result: pass-pending-runtime
evidence: |
  Fix landed 2026-06-17 as four atomic commits on
  features/v1.13-hook-bridge:

      f99f48d test(63): RED regression test for SessionStart additionalContext drain
      ce59eda fix(63): bridge SessionStart additionalContext to before_agent_start
      1ccd511 test(63): integration test for SessionStart additionalContext drain
      cbc4206 test(63): drop redundant type assertion in additionalcontext e2e

  Root cause: Pi's event lifecycle splits "session lifecycle"
  (session_start, void return) from "context injection"
  (before_agent_start, returns systemPrompt). The Claude Code
  SessionStart-hook protocol assumes a unified surface. Phase 63's
  bridge subscribed session_start correctly but never wired the
  additionalContext payload over to Pi's actual context-injection
  slot (before_agent_start). `adaptObservationResult` silently dropped
  the mutate arm because the session_start handler return type IS
  void -- the drop was honest at the per-event level but the
  cross-event plumbing was missing.

  Fix shape:
    1. Added a `pendingSessionStartContext: string[]` module cell on
       event-router.ts.
    2. Added `appendPendingSessionStartContext()` setter +
       `beforeAgentStartHandlerFor(capturedEpoch)` factory.
    3. Added `adaptObservationResultForEvent()` to event-adapters.ts
       with per-event narrowing: SessionStart mutate -> append into
       buffer; SessionEnd / PreCompact / PostCompact -> silent-drop
       (no downstream drain point).
    4. Routed `dispatch.ts::adaptForEvent` through the per-event
       variant so the SessionStart capture path fires.
    5. Added `pi.on("before_agent_start", ...)` registration to
       registerHooksBridge (8 pi.on call sites total, up from 7).
    6. The buffer is cleared on every registerHooksBridge entry so
       /reload cannot leak stale context across sessions.

  `npm run check` green: 2296 passing + 1 skipped (up from 2285 + 1)
  + 14 integration (up from 12). 11 net-new unit assertions from
  the SessionStart-additional-context unit suite plus 2 net-new
  integration tests (HOOK-E2E-03 + HOOK-E2E-04).

  Pending runtime probe by the user to flip status from
  `pass-pending-runtime` to `pass`: re-run the rate-limiter probe
  from the pi-uat sandbox and confirm the learning-mode markers
  appear in Pi's response.
note: |
  Logged on 2026-06-17 post test-9 closure. The dispatch-side fix
  (test 9, 6a28bc4 / 2dbbcbd) confirmed end-to-end that the
  handler IS spawning; this test pins the orthogonal additionalContext
  delivery contract. Routed to /gsd-debug as session
  `.planning/debug/sessionstart-additionalcontext-dropped.md`.

## Summary

total: 10
passed: 5
issues: 0
pending: 2
skipped: 0
blocked: 3
notes: |
  Tests 3/4/5 reached terminal `blocked` state: the binding wrapper-format
  fix (63-09) and cross-surface classifier parity fix (63-10) both landed
  and verified correctly at runtime. The residual `(unavailable)
  {unsupported hooks}` trip is structural -- hookify declares `Stop`, which
  is NOT in v1.13's BUCKET_A_EVENTS (Option A taken at the 63-09 checkpoint;
  Stop admission deferred to v1.14+).

  Re-opened on 2026-06-16T23:55Z by a post-code-review UAT cycle: test 8
  (hooks-only installed plugin list rendering) FAILED on
  `learning-output-style`. Root cause was a phase-63 read-side regression
  in `isRecordedButDisabled` (and its two drift twins) which were never
  extended with the new `resources.hooks` axis. Routed to /gsd-debug.

  Test 8 fix landed 2026-06-17 (debug session
  `.planning/debug/hooks-only-list-disabled.md`, five commits dbad53f /
  3639048 / d43b480 / b563ca7 / aae0e79). Operator confirmed the
  pi-uat runtime probe at 2026-06-17T01:45Z: both `/claude:plugin list`
  invocations now emit `(installed)`. UAT loop closed.

  Re-opened a second time on 2026-06-17T02:25Z: a follow-on runtime probe
  on the same `learning-output-style` plugin (now correctly classified
  `(installed)`) showed the SessionStart hook handler still never fires.
  Root cause was a SEPARATE, root-cause-independent dispatch-side bug:
  `rebuildRoutingTables` populated a single module-global routingTable
  from a per-scope filtered cache view, so the sequential per-scope
  rebuild calls in the registerHooksBridge boot loop wiped each other's
  buckets. Routed to /gsd-debug (session
  `.planning/debug/routing-table-cross-scope-wipe.md`).

  Test 9 fix landed 2026-06-17 as two atomic commits (6a28bc4 /
  2dbbcbd). `npm run check` green: 2285 passing + 1 skipped + 10
  integration. Pending operator runtime probe (touch-file at the
  source handler) to flip Test 9 from `pass-pending-runtime` to `pass`.

  Re-opened a third time on 2026-06-17T08:30Z: with test 9's
  dispatch-side fix landed and the SessionStart handler now firing
  end-to-end (sentinel touch-file proof at 2026-06-17T08:17:47Z),
  the operator ran a behavioral probe ("write a rate limiter") on
  `learning-output-style`. Pi implemented the rate limiter straight
  through with no `★ Insight` box, no contribution-request pause --
  the plugin's intended `additionalContext` payload was reaching
  HookExecResult.mutate but being silently dropped at
  `event-adapters.ts::adaptObservationResult`'s mutate arm. Root
  cause was a missing cross-event plumb: Pi's `session_start`
  handler return type is `void`, but `before_agent_start` carries
  the `systemPrompt` chain extensions use for context injection.
  The bridge subscribed `session_start` correctly but never wired
  the additionalContext payload over to `before_agent_start`. Routed
  to /gsd-debug (session
  `.planning/debug/sessionstart-additionalcontext-dropped.md`).

  Test 10 fix landed 2026-06-17 as four atomic commits (f99f48d /
  ce59eda / 1ccd511 / cbc4206). `npm run check` green: 2296
  passing + 1 skipped + 14 integration. Pending operator runtime
  probe (rate-limiter prompt + observe for `★ Insight` markers) to
  flip Test 10 from `pass-pending-runtime` to `pass`.

## Gaps

- truth: "Installing hookify@claude-plugins-official produces (installed) row + on-disk hooks.json + reload hint"
  status: resolved-with-deferrals
  closed: 2026-06-16T21:40:59Z
  closed_by: ["63-09", "63-10"]
  deferred_to: "v1.14+ (Stop-event admission to BUCKET_A_EVENTS)"
  closure_note: |
    The two diagnosed root causes are closed: the wrapper-format wire-contract
    bug (63-09) and the cross-surface classifier asymmetry (63-10). However,
    the user-reported claim "uses only bucket-A supported events" was
    incorrect -- hookify ships `Stop`, which is NOT in v1.13's BUCKET_A_EVENTS.
    Per the 63-09 Option A user decision, Stop admission is deferred to v1.14+.
    Runtime UAT against the pi-uat sandbox confirms hookify still flips
    `(unavailable) {unsupported hooks}` -- but the trip is now the honest
    bucket-A supportability gate, not the wrapper-format parser bug or the
    cross-surface classifier asymmetry.
  reason: "User reported: hookify is classified `(unavailable) {unsupported hooks}` (info) / `(unavailable) {unsupported source}` (install cascade) despite using only bucket-A supported events (PreToolUse, PostToolUse, Stop, UserPromptSubmit). Install never reaches the hooks-bridge slot."
  severity: blocker
  test: 3
  root_cause: |
    HOOKS_CONFIG_SCHEMA in extensions/pi-claude-marketplace/domain/components/hooks.ts:185
    encodes the upstream Claude Code SETTINGS-format shape
    (`Type.Record(Type.String(), Type.Array(HOOK_ENTRY_SCHEMA))` — bare top-level event keys)
    but is applied to plugin `hooks/hooks.json` files, which the upstream Claude Code spec
    REQUIRES to use the PLUGIN-format wrapper
    (`{description?: string, hooks: {<event>: [...], ...}}`). The two are documented as
    distinct formats. `parseHooksConfig` (hooks.ts:288) calls `HOOKS_VALIDATOR.Check(parsed)`
    with no unwrap step, so every real upstream plugin (hookify ships the wrapper)
    fails validation at `/description: expected array`, the resolver flips
    `installable: false` BEFORE the install cascade reaches the Phase 63 hooks-bridge
    slot, and downstream narrowers map the resulting note to misleading REASONS tokens.

    This is an original-implementation gap from Phase 57 (commit 43aad1e) attributed to
    D-57-02. Phase 63 Plan 08 (commit ba6632d, WR-05) ALSO flipped the test fixture
    `HOOKS_VALUE` in tests/bridges/hooks/stage.test.ts FROM the wrapped form TO the
    bare-event-key form to make the tests pass, which made the wire-format bug
    invisible to the unit suite.
  artifacts:
    - path: "extensions/pi-claude-marketplace/domain/components/hooks.ts:185"
      issue: "HOOKS_CONFIG_SCHEMA encodes the settings-file shape, not the plugin hooks.json wrapper shape (per upstream Claude Code SKILL.md)."
    - path: "extensions/pi-claude-marketplace/domain/components/hooks.ts:273-320"
      issue: "parseHooksConfig calls HOOKS_VALIDATOR.Check(parsed) with no wrapper unwrap step."
    - path: "tests/bridges/hooks/stage.test.ts:40-42"
      issue: "HOOKS_VALUE uses the bare-event-key shape (post-WR-05 flip); fixture pins the wrong wire format."
    - path: "tests/orchestrators/marketplace/cascade.test.ts:166"
      issue: "Sibling HOOKS_VALUE fixture using the bare-event-key shape (per WR-05 parity)."
    - path: "tests/transaction/lifecycle-cascade.test.ts:147"
      issue: "Sibling HOOKS_VALUE fixture using the bare-event-key shape (per WR-05 parity)."
    - path: "tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/hooks/hooks.json"
      issue: "Canonical upstream wire format example (the wrapped shape); use as test fixture verbatim."
  missing:
    - "Add wrapper-detection step at the head of parseHooksConfig: after JSON.parse, if the parsed value is a plain object whose top-level shape looks like `{description?: string, hooks: object, ...}`, validate `parsed.hooks` instead of `parsed`. Otherwise validate `parsed` as today (backward-compatible)."
    - "Update JSDoc on HOOKS_CONFIG_SCHEMA and parseHooksConfig to document the two-arm parser contract and cite the upstream SKILL.md as the format authority."
    - "Flip the three test fixtures (stage.test.ts, cascade.test.ts, lifecycle-cascade.test.ts) BACK to the wrapped form — invert the WR-05 change."
    - "Add a parser unit test using hookify's actual hooks.json bytes (copied verbatim from tmp/pi-uat/.../hookify/hooks/hooks.json) asserting parseHooksConfig returns {ok: true}."
    - "After the fix, re-run /claude:plugin install hookify@claude-plugins-official and expect installable: true + (installed) row + tmp/pi-uat/agent/pi-claude-marketplace/hooks/hookify/hooks.json on disk."
  debug_session: ".planning/debug/hookify-unavailable-resolver-flip.md"
- truth: "Same plugin reports the same (unavailable) reason across surfaces (info / list / install cascade)"
  status: resolved
  closed: 2026-06-16T21:40:59Z
  closed_by: ["63-10"]
  closure_note: |
    Closed verbatim. The 63-10 cross-surface parity arm mirrors the four
    `hooks.json`-prefix arms already in `narrowResolverNotes`, so both
    `info` and the install cascade now emit the SAME
    `(unavailable) {unsupported hooks}` token for the SAME on-disk
    hooks-config failure. Runtime UAT confirms parity at the user surface.
  reason: "User reported: hookify shows {unsupported hooks} from `info hookify@claude-plugins-official` but shows {unsupported source} in the install cascade's marketplace-listing block — same plugin, different reason between contexts."
  severity: major
  test: 3
  root_cause: |
    Classifier asymmetry between the two surfaces. The info / list probe surface uses
    `shared/probe-classifiers.ts::narrowResolverNotes` (lines 87-123), which matches
    four `hooks.json` prefixes (`hooks.json is not valid JSON:`,
    `hooks.json failed schema validation:`, `unsupported hooks:`,
    `malformed hooks.json:`) and emits the `unsupported hooks` REASON. The install
    cascade surface uses `orchestrators/plugin/install.ts::narrowResolverReasons`
    (lines 1689-1736), which has NO arm for the same `hooks.json` prefix family;
    the note lacks the `"source"` substring, so it falls through to the conservative
    fallback and emits `{unsupported source}`. Both narrowers see the SAME note for
    the SAME plugin, but classify it to different tokens.

    Once gap 1 is fixed, hookify will be installable and this asymmetry will become
    invisible for real-world plugins — but the install-surface classifier still has
    a structural gap that will resurface on any future malformed-hooks.json case
    (JSON syntax error, schema mismatch on a hand-authored plugin), so the parity
    fix is needed independently for defense in depth.
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1689-1736"
      issue: "narrowResolverReasons lacks an arm for the `hooks.json` / `malformed hooks.json:` / `unsupported hooks:` prefix family; notes fall through to the catch-all `{unsupported source}` bucket."
    - path: "extensions/pi-claude-marketplace/shared/probe-classifiers.ts:87-123"
      issue: "Reference implementation — the four prefixes are already enumerated correctly here; install.ts narrowResolverReasons should mirror this set."
  missing:
    - "In install.ts::narrowResolverReasons, add an arm matching the same four `hooks.json` prefixes that narrowResolverNotes already handles, mapping them to `{unsupported hooks}` (same closed REASONS token)."
    - "Add a cross-surface invariant test: for a synthetic plugin with a deliberately-malformed hooks.json, assert that info(plugin) and install(plugin) cascade emit the SAME (unavailable) {<reason>} token."
  debug_session: ".planning/debug/hookify-unavailable-resolver-flip.md"
- truth: "README's `## Features` section lists every supported component kind in v1.13"
  status: resolved
  closed: 2026-06-16T21:40:59Z
  closed_by: ["63-11"]
  closure_note: |
    Closed verbatim. README.md `## Features` bullet list now includes
    `- Hooks. See [Hook support reference](docs/hooks.md).` (commit 7967ea8).
  reason: "User reported: hooks are not mentioned in the README Features bullet list (README.md:21-30) even though v1.13 ships hook support and `## Hook support` (README.md:171) is a separate section. The features list still reads Commands / Skills / Agents / MCP servers."
  severity: cosmetic
  test: 7
  root_cause: |
    Phase 63 Plan 06 added the `## Hook support` section to README (line 171) and
    authored docs/hooks.md, but did not amend the `## Features` bullet list at
    README.md:21-30. No subagent investigation needed — the missing bullet is the
    issue itself.
  artifacts:
    - path: "README.md:21-30"
      issue: "Features bullet list omits the Hooks component kind even though v1.13 supports it."
  missing:
    - "Add a Hooks bullet to README.md's `## Features` list. Suggested wording: `- Hooks. See [Hook support reference](docs/hooks.md).` Slot it to match the COMPONENT_KINDS tuple order in shared/notify.ts (agents, commands, hooks, mcp, skills — i.e. between Commands and MCP servers)."
  debug_session: "(none — trivial doc fix; no investigation needed)"
- truth: "A hooks-only installed plugin renders `(installed)` -- not `(disabled)` -- on /claude:plugin list"
  status: resolved
  opened: 2026-06-16T23:55:00Z
  closed: 2026-06-17T01:45:00Z
  runtime_verified: 2026-06-17T01:45:00Z
  closed_by:
    - "dbad53f fix(63): add resources.hooks axis to recorded-but-disabled predicates"
    - "3639048 fix(63): zero resources.hooks in disable + partial-cascade fold"
    - "d43b480 test(63): cover hooks axis in drift gate, truth table, and list"
    - "b563ca7 test(63): regression test for disable zeroing resources.hooks"
  closure_note: |
    Broad fix scope (A+B+C+D+E+F+G+H+I from the debug session) landed as
    four atomic commits. The three predicate copies
    (plan.ts::isRecordedButDisabled, update.ts::isRecordedButDisabled,
    enable-disable.ts::isCurrentlyDisabled) now carry the
    `resources.hooks.length === 0` axis. The isCurrentlyDisabled
    structural type literal gained `hooks: readonly string[]`. plan.ts
    JSDoc updated ("all four arrays" -> "all five arrays").

    Two latent companion regressions with the same v1.13 root cause
    closed in the same wave: runDisableBranch now zeroes
    `installed.resources.hooks` alongside the other four axes;
    applyPartialCascadeFold now accepts and filters `dropped.hooks`.

    Three test surfaces extended to prevent recurrence: T5 drift-gate
    requiredAxes now lists the hooks axis; T5 truth-table is now a
    3-axis matrix (the new (installable: true, populated: false,
    hooksPopulated: true) cell pins the hooks-only installed case);
    new list-renderer regression test asserts the row carries
    `(installed)`. Additional regression test pins runDisableBranch
    zeroing of resources.hooks.

    `npm run check` green: 2282 passing + 1 skipped (up from 2280 + 1)
    + 10 integration.

    Pending runtime probe by the user to flip status from
    `resolved-pending-runtime` to `resolved`: re-run
    `/claude:plugin install learning-output-style@claude-plugins-official` +
    `/claude:plugin list` + `/reload` + `/claude:plugin list` against the
    pi-uat sandbox. Both list invocations must render `(installed)`.
  reason: "User reported during post-code-review UAT on learning-output-style (a hooks-only, bucket-A-only plugin from claude-plugins-official): install cascade prints `(installed)` correctly, but `/claude:plugin list` renders the plugin row with `(disabled)` both before and after `/reload`. State.json confirms the plugin is installed (installable: true, resources.hooks = [\"learning-output-style\"], every other resource array empty) -- so the misclassification is on the read side, not the install path."
  severity: blocker
  test: 8
  root_cause: |
    Phase 63's hook bridge added `resources.hooks` to the state schema
    (D-63-04 / COMPONENT_KINDS 5-tuple) but did NOT extend the four
    "empty resources + installable: true => recorded-but-disabled"
    predicates that the read side relies on. All three predicate copies
    check `resources.{skills,prompts,agents,mcpServers}` for empty and
    return true when they are, treating a hooks-only installed plugin as
    "recorded but disabled" -- so `list.ts:255` routes the row to the
    `(disabled)` arm instead of `(installed)`.

    The two drift-gate / truth-table tests pin the same 4-axis list
    textually, so they happily passed against three CONSISTENTLY-wrong
    predicate copies; the drift gate fires only on textual disagreement.
    The single hooks list test (HOOK-01) exercises an `available` (not
    installed) hooks-plugin, never an installed hooks-only plugin -- so
    the read-side misclassification slipped past 2280 passing unit tests.
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:275-285"
      issue: "isRecordedButDisabled checks resources.{skills,prompts,agents,mcpServers}.length===0 + installable; never checks resources.hooks.length===0."
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:958-968"
      issue: "Duplicate of isRecordedButDisabled (IN-04 from 63-REVIEW.md) -- same missing hooks axis."
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:175-191"
      issue: "isCurrentlyDisabled (drift twin pinned to plan.ts by the T5 drift gate) -- same missing hooks axis."
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:255"
      issue: "Consumes isRecordedButDisabled and emits `status: \"disabled\"` for the row. No bug here; downstream of the predicate gap."
    - path: "tests/orchestrators/reconcile/plan.test.ts:713"
      issue: "T5 drift-gate's `requiredAxes` list pins the 4 pre-phase-63 axes; never references `resources.hooks.length === 0`. Gate passes against three consistently-wrong predicates."
    - path: "tests/orchestrators/reconcile/plan.test.ts:671"
      issue: "T5 truth-table exercises (installable x populated) over 4 axes; never the hooks axis."
    - path: "tests/orchestrators/plugin/list.test.ts:1083"
      issue: "Single hooks-related list test exercises an `available` plugin; never an installed hooks-only plugin through the list renderer."
    - path: "tmp/pi-uat/agent/pi-claude-marketplace/state.json"
      issue: "Post-install record for learning-output-style proves resources.hooks = [...] and all other resource arrays empty + installable: true -- the exact input the predicate misclassifies."
  missing:
    - "Add `record.resources.hooks.length === 0` (and the matching declared-shape entry) to all three predicate copies: plan.ts::isRecordedButDisabled, update.ts::isRecordedButDisabled (the IN-04 duplicate -- consider unifying), enable-disable.ts::isCurrentlyDisabled."
    - "Extend the T5 drift gate `requiredAxes` array (plan.test.ts:744) with `resources.hooks.length === 0`."
    - "Extend the T5 truth-table fixtures (plan.test.ts:671) with a hooks-axis dimension so the (installable: true, populated: false) cell now requires hooks-empty as well."
    - "Add a list-renderer regression test: install a hooks-only plugin (resources.hooks non-empty, every other resource axis empty, installable: true), call listPlugins, assert the row carries the `(installed)` status token -- not `(disabled)`."
    - "After the fix, re-run /claude:plugin install learning-output-style@claude-plugins-official + /claude:plugin list against the pi-uat sandbox and confirm the row renders `(installed)` both before and after /reload."
  debug_session: ".planning/debug/hooks-only-list-disabled.md"
- truth: "A hooks-only user-scope plugin's SessionStart handler is spawned by Pi at session_start"
  status: resolved-pending-runtime
  opened: 2026-06-17T02:25:00Z
  closed: 2026-06-17T02:50:00Z
  closed_by:
    - "6a28bc4 test(63): regression test for cross-scope routing-table wipe"
    - "2dbbcbd fix(63): rebuild routing table from full cross-scope cache"
  closure_note: |
    Fix landed as two atomic commits. `rebuildRoutingTables` now walks
    the entire cross-scope `parsedConfigCache` instead of filtering
    by `loc.scope`, so sequential per-scope rebuilds (the
    registerHooksBridge boot loop and applyReconcile's per-scope
    loop) no longer wipe each other's buckets in the single
    module-global `routingTable`.

    Cache-walk semantics required the disable path to drop its
    parsed-config cache entry alongside the on-disk hooks.json
    unstage (the OLD state-side filter masked this -- a disabled
    plugin's resources.hooks went to [] and the state-walk skipped
    it). `runDisableBranch` now calls removePluginConfigFromCache +
    rebuildRoutingTables in both the success arm and the
    partial-cascade-failure arm (gated on
    cascade.dropped.hooks being non-empty), mirroring the WR-03
    invariant already in install / uninstall.

    Two new regression tests pin the cross-scope walk (event-router.
    test.ts "sequential per-scope rebuild preserves entries across
    scopes" + "cross-scope cache walk includes BOTH scopes' entries
    simultaneously"). Two existing tests updated to align with the
    new cache-as-source-of-truth contract (event-router.test.ts
    cross-plugin sort + empty-cache rebuild, plus the same
    architecture-level twin in hooks-dispatch.test.ts DISP-04).

    `npm run check` green: 2285 passing + 1 skipped (up from 2282 +
    1) + 10 integration. Pending operator runtime probe (touch-file
    at the source handler) to flip the gap from
    `resolved-pending-runtime` to `resolved`.
  reason: "Operator follow-on runtime probe on 2026-06-17T02:25Z: with test 8's read-side fix landed and learning-output-style now classified `(installed)`, the plugin's SessionStart handler is still never spawned. A touch-file probe in the source handler (sed-inserted on hooks-handlers/session-start.sh) produces no /tmp/learning-fired.log after Pi launch + immediate quit. Side effects in the handler (the learning-mode prompt with `★ Insight ─────`, contribution requests) are absent from Pi's behavioral output. State.json + on-disk hooks.json are correct; the gap is between cache and dispatch."
  severity: blocker
  test: 9
  root_cause: |
    `routingTable` in `bridges/hooks/event-router.ts:125` is a single
    module-global `Map<BucketAEvent, ReadonlyArray<RoutingEntry>>`, but
    `rebuildRoutingTables(state, loc)` clears every bucket and then
    populates only the entries from the passed-in scope via
    `collectPluginsInScope(state, loc.scope)`. The
    registerHooksBridge boot loop walks [user, project] sequentially;
    the empty project rebuild immediately overwrote the user-scope's
    SessionStart bucket with []. session_start fired between the wipe
    and any later rebuild (a subsequent rebuild from
    resources_discover restored the entry, but too late).

    The cache (`parsedConfigCache`) is the cross-scope authoritative
    source already maintained correctly by install / uninstall /
    update / reinstall + hydrate. The bug is that rebuild filters
    the cache by scope when it should walk the entire cache.
  artifacts:
    - path: "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:125"
      issue: "Module-global routingTable Map shared across scopes."
    - path: "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:210"
      issue: "rebuildRoutingTables clears all buckets, then populates only the passed-in scope's entries via collectPluginsInScope -- per-scope wipes one another in sequential calls."
    - path: "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:243"
      issue: "collectPluginsInScope filters state-side by `mpRecord.scope !== scope` AND cache-side by cacheKey(scope, ...) -- both layers drop cross-scope entries."
    - path: "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:599-625"
      issue: "registerHooksBridge boot loop calls rebuildRoutingTables for both scopes sequentially -- the last scope's empty view wins."
    - path: "extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:888-899"
      issue: "rebuildScopeRoutingTable inside applyReconcile's per-scope loop has the same sequential-per-scope shape; same wipe."
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:runDisableBranch"
      issue: "Latent companion bug: cascadeUnstagePlugin removes on-disk hooks.json but the cache entry is never dropped. Harmless under the OLD state-side filter; with the NEW cache-walk it would re-surface in the routing table."
  missing:
    - "Switch rebuildRoutingTables to walk the entire parsedConfigCache cross-scope instead of state-filtering by loc.scope. Retain the (state, loc) signature for caller compatibility (every orchestrator threads the locked transaction state through); the params become intentionally unused at the rebuild site. Replace collectPluginsInScope with collectAllCachedPlugins."
    - "Add removePluginConfigFromCache + rebuildRoutingTables to runDisableBranch (both the success arm and the partial-cascade-failure arm gated on cascade.dropped.hooks being non-empty). Mirrors the WR-03 invariant already in install / uninstall."
    - "Update the JSDoc on rebuildRoutingTables to document the cross-scope cache walk."
    - "Add a regression test pair to tests/bridges/hooks/event-router.test.ts: (a) install a user-scope SessionStart-declaring plugin, rebuild for user (assert 1 entry), rebuild for empty project state (assert 1 entry still); (b) populate both scopes' cache and assert a single rebuild surfaces all entries alphabetically."
    - "Update existing tests whose assertions encoded the per-scope filter: event-router.test.ts cross-plugin sort + empty-cache rebuild, plus hooks-dispatch.test.ts DISP-04. They now match the cache-walk semantics (single rebuild surfaces all cross-scope entries; empty buckets require explicit removePluginConfigFromCache, not just state mutation)."
    - "After the fix, operator re-runs the touch-file probe: install learning-output-style, sed-insert `echo \"fired at $(date -Iseconds)\" >> /tmp/learning-fired.log` at the top of hooks-handlers/session-start.sh in the source tree, `rm -f /tmp/learning-fired.log`, relaunch Pi, quit immediately, confirm /tmp/learning-fired.log exists with a single timestamped line."
  debug_session: ".planning/debug/routing-table-cross-scope-wipe.md"
- truth: "A SessionStart hook's additionalContext payload is injected into Pi's next agent turn (model sees it on the first turn)"
  status: resolved-pending-runtime
  opened: 2026-06-17T08:30:00Z
  closed: 2026-06-17T09:30:00Z
  closed_by:
    - "f99f48d test(63): RED regression test for SessionStart additionalContext drain"
    - "ce59eda fix(63): bridge SessionStart additionalContext to before_agent_start"
    - "1ccd511 test(63): integration test for SessionStart additionalContext drain"
    - "cbc4206 test(63): drop redundant type assertion in additionalcontext e2e"
  closure_note: |
    Fix landed as four atomic commits. The bridge now wires Pi's
    `session_start` (void return slot) and `before_agent_start`
    (carries the systemPrompt chain) across a single module-state
    buffer. SessionStart's mutate arm appends `additionalContext`
    into the buffer via the new
    `adaptObservationResultForEvent` per-event narrowing variant
    (legacy `adaptObservationResult` shim retained for the
    architecture-level exhaustiveness gate). The new
    `beforeAgentStartHandlerFor` factory produces the closure
    registered on `before_agent_start`; it joins the buffered
    entries with `\n\n` and prepends `event.systemPrompt + "\n\n"`,
    then clears the buffer (one-shot drain).

    The buffer resets on every `registerHooksBridge` entry so
    `/reload` cannot leak stale context across sessions; an
    epoch-mismatched stale closure short-circuits without
    draining the live buffer (zombie defense).

    `registerHooksBridge` now registers 8 pi.on call sites
    (up from 7): the existing 7 Bucket-A dispatch surfaces plus
    `before_agent_start`. Architecture invariant pinned in
    `tests/architecture/hooks-dispatch.test.ts` DISP-01 (8-tuple
    locked); `tests/shared/index-smoke.test.ts` event registration
    list extended with `before_agent_start`.

    Two new test files pin the contract:
      - `tests/bridges/hooks/session-start-additional-context.test.ts`
        (12 unit tests across capture, drain, multi-plugin concat,
        empty-buffer, epoch-mismatch, /reload-clears).
      - `tests/integration/hooks-additionalcontext-end-to-end.test.ts`
        (HOOK-E2E-03 covers the full bash-spawn -> stdout JSON ->
        wire-protocol parse -> mutate capture -> drain -> systemPrompt
        slot cycle; HOOK-E2E-04 pins the /reload-clears-buffer
        contract via registerHooksBridge re-entry).

    `npm run check` green: 2296 passing + 1 skipped (up from
    2285 + 1) + 14 integration (up from 12).

    Pending operator runtime probe to flip status from
    `resolved-pending-runtime` to `resolved`: re-run the
    rate-limiter probe against the pi-uat sandbox and confirm
    learning-mode markers appear in Pi's response (`★ Insight`
    box, contribution-request pause at the algorithm-choice point,
    or at minimum a mention of "learning mode").
  reason: "Operator follow-on runtime probe on 2026-06-17T08:30Z: with test 9's routing-table fix landed and the SessionStart handler now firing end-to-end (sentinel touch-file proven at 2026-06-17T08:17:47Z), the behavioral probe (`write a rate limiter` against learning-output-style installed) shows Pi implementing the rate limiter straight through with NONE of the plugin's intended learning-mode markers (`★ Insight` box, contribution-request pause) appearing. The plugin's `additionalContext` payload is being parsed by `wire-protocol.ts` into a HookExecResult.mutate arm but silently dropped at `event-adapters.ts::adaptObservationResult`'s mutate arm because Pi's `session_start` handler return type is `void` and the bridge never wired the payload over to Pi's actual context-injection slot (`before_agent_start`'s `systemPrompt` chain)."
  severity: blocker
  test: 10
  root_cause: |
    Pi's event lifecycle splits "session lifecycle" (session_start,
    void return) from "context injection" (before_agent_start,
    returns systemPrompt chained across extensions per
    pi-coding-agent/dist/core/extensions/runner.js:745-790). The
    Claude Code SessionStart-hook protocol assumes a unified
    "inject context into the next agent turn" pathway. Phase 63's
    bridge subscribed `session_start` (correctly mirroring the
    upstream event name) but never wired the additionalContext
    payload over to Pi's actual context-injection surface
    (`before_agent_start`). The
    `adaptObservationResult` mutate-arm drop was honest at the
    per-event level (session_start.return type IS void) but the
    cross-event plumbing was missing.

    Two read sites confirmed the diagnosis mechanically:
      1. `bridges/hooks/wire-protocol.ts:154` parses
         `additionalContext` correctly into HookExecResult.mutate.
      2. `bridges/hooks/event-adapters.ts:271` had explicit
         `case "mutate": ... silently drop ... return undefined`.
      3. `bridges/hooks/event-router.ts:621` subscribed 7 events;
         `before_agent_start` was NOT among them.
      4. `pi-coding-agent` exports `BeforeAgentStartEvent` and
         `BeforeAgentStartEventResult` with a chained
         `systemPrompt?: string` slot; the runner.js loop iterates
         every extension and folds each return's `systemPrompt`
         into `currentSystemPrompt` for the next extension and
         the agent.
  artifacts:
    - path: "extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:271"
      issue: "adaptObservationResult.mutate arm silently dropped additionalContext for SessionStart even though Pi has a downstream context-injection slot."
    - path: "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:621"
      issue: "registerHooksBridge registered 7 pi.on call sites; before_agent_start (the drain point) was not among them."
    - path: "extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts:154"
      issue: "Reference site -- parses additionalContext into HookExecResult.mutate correctly; nothing to change here."
    - path: "node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:740-793"
      issue: "Reference -- shows Pi's before_agent_start emit loop chains each extension's returned systemPrompt across iterations."
    - path: "node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:489-499,758-762"
      issue: "Reference -- BeforeAgentStartEvent.systemPrompt and BeforeAgentStartEventResult.systemPrompt are the canonical slot."
  missing:
    - "Add a `pendingSessionStartContext: string[]` module-state cell on event-router.ts. Concat semantics support multiple SessionStart-bearing plugins."
    - "Add an `appendPendingSessionStartContext(text)` setter + a `beforeAgentStartHandlerFor(capturedEpoch)` factory exported from event-router.ts. The handler joins the buffer with `\\n\\n` and prepends `event.systemPrompt + \"\\n\\n\"`, then clears the buffer (one-shot drain). Empty buffer returns undefined."
    - "Add `adaptObservationResultForEvent(result, claudeEvent)` to event-adapters.ts. For SessionStart mutate.additionalContext, call appendPendingSessionStartContext; otherwise silent-drop. Legacy adaptObservationResult retained for the architecture-level 4-arm exhaustiveness gate."
    - "Route dispatch.ts::adaptForEvent through adaptObservationResultForEvent so the SessionStart capture path fires in production."
    - "Add pi.on(`before_agent_start`, beforeAgentStartHandlerFor(capturedEpoch)) to registerHooksBridge (8 pi.on call sites total). Reset the buffer on every registerHooksBridge entry so /reload cannot leak stale context."
    - "Re-export BeforeAgentStartEvent and BeforeAgentStartEventResult from platform/pi-api.ts."
    - "Update tests/architecture/hooks-dispatch.test.ts DISP-01 to assert 8 pi.on calls including before_agent_start; update tests/shared/index-smoke.test.ts event-name list to include before_agent_start."
    - "Add unit-level regression test pinning per-event capture and drain semantics (multi-plugin concat, empty buffer, second-turn undefined, epoch mismatch, /reload-clears-buffer)."
    - "Add integration test exercising the full handler-stdout-JSON -> wire-protocol parse -> mutate capture -> drain -> systemPrompt slot cycle through real `spawn(bash, [...])`."
    - "After the fix, operator re-runs the rate-limiter probe: `scripts/pi.sh --home /home/acolomba/pi-claude-marketplace/tmp/pi-uat`, in the Pi REPL: `write me a simple in-memory rate limiter for an HTTP API`. Expected: Pi exhibits learning-mode framing (`★ Insight ──────` box, contribution-request pause at the algorithm-choice decision point, or at minimum a mention of `learning mode`) -- absent in the pre-fix baseline."
  debug_session: ".planning/debug/sessionstart-additionalcontext-dropped.md"
