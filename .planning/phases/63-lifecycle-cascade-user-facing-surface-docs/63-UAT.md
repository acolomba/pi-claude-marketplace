---
status: complete
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
  reason: "User reported: hookify is classified `(unavailable) {unsupported hooks}` (info) / `(unavailable) {unsupported source}` (install cascade) despite using only bucket-A supported events (PreToolUse, PostToolUse, Stop, UserPromptSubmit). Install never reaches the hooks-bridge slot — the resolver flips installable: false earlier. Likely a contract mismatch: domain/components/hooks.ts:185 HOOKS_CONFIG_SCHEMA = Type.Record(Type.String(), HOOK_EVENT_ARRAY_SCHEMA) expects top-level event keys, but the upstream Claude wire format hookify ships uses the wrapped envelope `{\"description\":..., \"hooks\":{...}}`. parseHooksConfig validates the raw JSON.parse output without unwrapping, so the validator rejects the description string + nested object, emits `hooks.json failed schema validation: ...`, and the resolver flips installable: false."
  severity: blocker
  test: 3
  artifacts:
    - "extensions/pi-claude-marketplace/domain/components/hooks.ts:185 (HOOKS_CONFIG_SCHEMA)"
    - "extensions/pi-claude-marketplace/domain/components/hooks.ts:273-320 (parseHooksConfig)"
    - "tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/hooks/hooks.json (real wire format example)"
  missing:
    - "Decide whether the parser unwraps `{hooks: {...}}` before validation or whether HOOKS_CONFIG_SCHEMA is extended to accept the wrapped form (matches upstream Claude Code wire shape)."
    - "Re-run /claude:plugin install hookify@claude-plugins-official; expect installable: true and (installed) row."
- truth: "Same plugin reports the same (unavailable) reason across surfaces (info / list / install cascade)"
  status: failed
  reason: "User reported: hookify shows {unsupported hooks} from `info hookify@claude-plugins-official` but shows {unsupported source} in the install cascade's marketplace-listing block — same plugin, different reason between contexts. Hypothesis: the info path and the list/install path build different `notes[]` arrays for the same plugin; shared/probe-classifiers.ts::narrowResolverNotes is a catch-all (hooks-keyword → `unsupported hooks`, `lspServers` → `lsp`, anything else → `unsupported source`), so two different upstream notes naturally produce two different REASONS tokens. The fact that the source `./plugins/hookify` parses as `{kind: \"path\"}` (sourceUnsupportedReason returns undefined) means the `{unsupported source}` reason from the install cascade is the CATCH-ALL bucket — some unclassified note is falling through. The two probe sites should produce the same notes for the same plugin."
  severity: major
  test: 3
  artifacts:
    - "extensions/pi-claude-marketplace/shared/probe-classifiers.ts:87-123 (narrowResolverNotes)"
    - "extensions/pi-claude-marketplace/domain/resolver.ts (note-emitting sites)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts (info call site)"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts (list/install cascade call site)"
  missing:
    - "Locate where the install/list cascade emits a note that classifies to `unsupported source` for hookify."
    - "Decide whether the install path should match info's deeper probe, or whether the catch-all in narrowResolverNotes is too broad and should be tightened."
    - "Add a test pinning that info(plugin) and list(plugin)/install(plugin) yield the same `(unavailable) {<reason>}` tokens for any given plugin (cross-surface invariant)."
- truth: "README's `## Features` section lists every supported component kind in v1.13"
  status: failed
  reason: "User reported: hooks are not mentioned in the README Features bullet list (README.md:21-30) even though v1.13 ships hook support and `## Hook support` (README.md:171) is a separate section. The features list still reads Commands / Skills / Agents / MCP servers."
  severity: cosmetic
  test: 7
  artifacts:
    - "README.md:21-30 (Features section)"
  missing:
    - "Add a Hooks bullet to the README Features list. Suggested: `- Hooks. See [Hook support reference](docs/hooks.md).` slotted alphabetically (between Commands and MCP servers, or after Agents — match the COMPONENT_KINDS tuple ordering for consistency)."
