---
status: diagnosed
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
started: 2026-06-16T18:23:24Z
updated: 2026-06-16T19:08:00Z
---

## Current Test

[testing complete]

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
result: issue
reported: |
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
result: issue
reported: |
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
result: issue
reported: "fail, because we never installed it"
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

## Summary

total: 7
passed: 4
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Installing hookify@claude-plugins-official produces (installed) row + on-disk hooks.json + reload hint"
  status: failed
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
  status: failed
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
  status: failed
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
