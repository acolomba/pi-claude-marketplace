---
phase: 10-plugin-options-variables-and-trust
reviewed: 2026-11-15T19:54:38Z
depth: standard
files_reviewed: 64
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/staged-command.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts
  - extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts
  - extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/builtin-escape.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/domain/argument-substitution.ts
  - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
  - extensions/pi-claude-marketplace/domain/components/plugin.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/domain/unsupported-components.ts
  - extensions/pi-claude-marketplace/domain/user-config.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/command-invocation.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-options.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - extensions/pi-claude-marketplace/shared/vars.ts
  - features/step_definitions/hook/messages.steps.ts
  - features/step_definitions/mcp-server/builtin-options.steps.ts
  - features/step_definitions/mcp-server/options.steps.ts
  - features/step_definitions/model.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/support/world.ts
findings:
  critical: 0
  warning: 3
  info: 8
  total: 11
  necessity: 1
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-11-15T19:54:38Z
**Depth:** standard
**Files Reviewed:** 64
**Status:** issues_found

## Summary

I reviewed the 64 files of the phase diff (`git diff c888a7ce HEAD`) at standard depth. I traced the callers across the option data path: the resolver, the install record, the hooks hydrate, the adapter stage, the built-in registration, the process-variable ledger, and PATH. I also read pi-mcp-adapter 7.0.1 `utils.ts` and `server-manager.ts` to check how it expands the owned option variables. A leading `!` is tested on the raw entry value before interpolation, so an option value that starts with `!` is not run as a shell command. The split-token escape in the variable value also holds against the adapter's later passes.

The trust gating for PATH and the option variables follows D-PG10-02 and D-PG10-23. The recorded items the caller listed (D-PG10-01, the nested `:-` default, the conservative `~` block, the redactAbsolutePaths backlog bug) are not reported.

I found no Critical issue. There are three Warnings:

- The AMIG-01 move can stage adapter entries with option references while it leaves the record's `userConfig` unwritten. The load then sets no variable for those references.
- `recordedOptionsOf` treats a corrupt stored `userConfig` as "no options". This breaks the fail-closed rule for corrupt data, and the built-in MCP then registers servers with literal `${user_config.*}` text.
- The exec-form hook fill rescans spliced path values for option references, which contradicts its own doc comment and the T-10-24 mitigation.

The Info items cover fragile or dead code, classification consistency, and smaller gaps in parity and robustness.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: AMIG-01 move stages option references but the record's `userConfig` is written only when the MCP verdict changes

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:569-604` (with `:474-486`, `:614-628`)
**Issue:** `stagedSource` stages a moving owner's servers with `options: declaredOptions(resolveOptions(action.resolved.declaredUserConfig))`. So when the source declares `userConfig`, `prepareStageMcpServers` writes `${PI_CLAUDE_MARKETPLACE_OPTION_<hex>}` references into `mcp-adapter.json`. The matching `replaceUserConfig(record, ...)` is inside `applyNeutralVerdict`, and that function returns early in two cases: when `recorded.kind === "unreadable"`, and when the record already has `compatibilityBasis: "neutral"` with the same `installable`/`unsupported`. Every install since MREC-01 writes `compatibilityBasis: "neutral"` (`install-outcome.ts:1696`). So a record from before this phase, which has no `userConfig`, can keep no `userConfig` while its adapter entries reference option variables.

At the next load, `plugin-options.ts::stateVariables` reads `recordedOptionsOf(record)`, gets no options, and sets no variable. pi-mcp-adapter then expands each reference to `""` (`interpolateEnvVars`). In a `url`, the server fails with "Missing environment variable". D-PG10-23's comment ("so the staged entries and the record agree") does not hold on this path.

There is a second mismatch. The same function writes `mcpServerConfigs` from the record's own `recorded.servers`, because "the staged source may be a newer version, whose servers the record must not claim (MREC-02)". But it writes `userConfig` from the source. So the hooks hydrate at load reads option defaults from a version other than the one whose hooks are staged.

**Fix:** Write the options wherever the move stages, independent of the verdict. For example, in `recordAction`:

```ts
const namesChanged = applyStagedNames(action.record, stagedNames);
const optionsChanged = action.arm === "move" && applyStagedOptions(action);
const compatibilityChanged = applyNeutralVerdict(action);
if (!namesChanged && !optionsChanged && !compatibilityChanged) return false;
```

Here `applyStagedOptions` compares `JSON.stringify(record.userConfig ?? null)` with the value that `userConfigFieldsOf(action.resolved.declaredUserConfig)` gives, and calls `replaceUserConfig` when they differ. Remove the `replaceUserConfig` call from `applyNeutralVerdict`. Also add an owner test where the record is already neutral and the source declares options.

### WR-02: A corrupt stored `userConfig` is read as "no options" and the load carries on, so it does not fail closed

**File:** `extensions/pi-claude-marketplace/persistence/state-io.ts:351-364`
**Issue:** `recordedOptionsOf` debug-logs a `userConfig` that does not parse and returns `resolveOptions(undefined)` (`declared: false`). The phase's own established pattern is "Fail closed on corrupt data" (10-CONTEXT `code_context`), and the project rule refuses with `{unreadable}` rather than skipping and carrying on. Here, a hand-edited or tampered record degrades differently on each surface:

- Built-in MCP (`builtin-registration-step.ts:264`): `declaredOptions(...)` is `undefined`. So no option pass runs, `mcpOptionBlock(server, undefined)` blocks nothing, and the server registers with literal `${user_config.KEY}` text in `command`/`args`/`env`/`url`/`headers`. A valid record would block that server instead.
- Adapter (`plugin-options.ts:73-76`): no variables are set, so every staged reference expands to `""`.
- Hooks (`event-router.ts:696`): every exec-form reference fails with "isn't set. Open /plugin manage...". This points the user at the wrong cause.

None of these surfaces tells the user anything. Only a `PI_CLAUDE_MARKETPLACE_DEBUG` log records it.

**Fix:** Return a discriminated result, `{ kind: "ok"; options } | { kind: "unreadable"; detail }`, and make each reader fail closed for that plugin. The built-in registration skips the plugin's servers. The variable pass keeps that plugin's prior names, or sets none, and the hooks hydrate does not route the plugin. Report one `{unreadable}` warning through the load run, as other corrupt-record cases do. If skipping is the intended policy, record it as a decision with an ID and make the built-in path block servers that name options (treat `declared` as true with an empty map) rather than register literals.

### WR-03: The exec-form hook fill rescans spliced path values for `${user_config.*}`, against its doc comment and the T-10-24 mitigation

**File:** `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts:70-75`
**Issue:** `fill = (text) => fillPluginOptions(substituteClaudeVars(text, vars), entry.options.values)` runs two passes. The option pass scans the output of the path pass. So any `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, or `${CLAUDE_PLUGIN_DATA}` value that holds `${user_config.X}` text is filled a second time. If the plugin has no value for `X`, every exec-form hook of that plugin throws `UnsetPluginOptionError`. Otherwise an option value is spliced into the middle of a path argument.

The function's own doc comment (`:46-50`) says "One pass: a spliced value is never rescanned". The plan's threat row T-10-24 ("a path value ... that holds another variable's text being filled a second time", mitigated by "One alternation pass that never scans a spliced value again") is met in `shared/vars.ts::substituteClaudeContent`, but not here. The trigger needs a directory name holding `${user_config.`, so it is unlikely, but the stated invariant is false on this lane. No owner test covers it (`test/bridges/hooks/spawn-helpers.test.ts:81-134` only puts option references in authored text).

**Fix:** Use one alternation pass, as `substituteClaudeContent` does. Add a strict-mode variant in `shared/vars.ts` that throws on a missing key, or build the pattern locally:

```ts
const fill = (text: string): string =>
  substituteClaudeExec(text, vars, entry.options.values); // one regex over path tokens | user_config.KEY; throws UnsetPluginOptionError for a missing key
```

Add an owner case where `vars.projectDir` contains `${user_config.mode}` and assert that it reaches the argument unchanged. If Claude Code 2.1.323's hook runner does rescan path values (path pass, then `Frn`), keep the two passes but correct the doc comment and T-10-24, and record that as the parity basis.

## Info

### IN-01: `optionPieces` finds each match again with `indexOf`, so a skipped reference can mis-split the field

**File:** `extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts:242-259`
**Issue:** The callback finds each match with `text.indexOf(matched, start)`. But `start` only moves forward for a match that has a segment. A skipped reference, with no name or no value, whose text contains a later reference as a suffix (for example, a key `zz${user_config.k` before a standalone `${user_config.k}`) makes `indexOf` find the wrong position, which splits the field wrongly. In production every caller first leaves out a server whose fields name a key without a value (`stage.ts:285`, `builtin-entry.ts:65`), so the skip branch cannot be reached today. The code is fragile rather than broken.
**Fix:** Walk `text.matchAll(USER_CONFIG_REFERENCE)` and use `match.index`, or export an index-aware walker from `user-config.ts` instead of calling `replaceUserConfigReferences` for its side effect.

### IN-02: On the `unavailable` arm the unset-required note reads as `unsupported source`

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:210-212`, `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:555-557`
**Issue:** A plugin can be unavailable for another structural reason and also declare a required option with no default. Its row then gets `unsupported source` for the option note, a token on the source axis, although the source is fine and the closed vocabulary now holds `options not set`. This follows the existing `contains <kind>` convention, but it gives a remedy on the wrong axis.
**Fix:** Map the note to `options not set` on both arms, or drop the note from the unavailable arm's reasons, since the structural reason already decides the verdict.

### IN-03: The async-rewake lane sends the D-PG10-08/D-PG10-10 refusals only to the debug log

**File:** `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:314`, caught at `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts:200-207`
**Issue:** `planSpawn` throws `UnsetPluginOptionError` or `ShellFormOptionReferenceError`. On the async lane, the outer catch only debug-logs that throw. So an async shell-form hook that names `${user_config.*}` silently never runs, while the same hook on the sync lane shows the user Claude Code's message. Other async spawn failures already behave this way, but these two errors are author-actionable messages that the phase added on purpose.
**Fix:** Report them through the same hook-notice path that the sync lane's `endedResult` uses, or record the async-lane behavior as intended.

### IN-04: The unset-option message tells the Pi user to run `/plugin manage`, which Pi does not have

**File:** `extensions/pi-claude-marketplace/shared/errors-bridges.ts:328-331`
**Issue:** The text is Claude Code's, verbatim. Pi has no `/plugin manage` command, and step 1 has no way to set a value. The remedy cannot be followed, which conflicts with the "remedy matches the failure axis" rule.
**Fix:** Keep the first sentence. Replace the remedy with one that works in Pi, such as giving the option a default or reinstalling once the plugin declares it, or record the verbatim text as a parity decision.

### IN-05: The whole-file content pass writes option values into frontmatter fields unescaped

**File:** `extensions/pi-claude-marketplace/bridges/skills/stage.ts:404`, `extensions/pi-claude-marketplace/bridges/commands/staged-command.ts:275-284`
**Issue:** Only the skill `description` is filled before YAML escaping (`augmentSkillDescription`). The whole-file pass also fills `${user_config.KEY}` in every other frontmatter value, for example `argument-hint` or `allowed-tools`, and in the command source before its frontmatter is parsed again. A default that holds `"`, `: `, `#`, or a newline can break the frontmatter or change its keys. In step 1 the text is the author's own, but step 2 values will be typed by the user.
**Fix:** Fill options in the body only, as the upstream "skill content" wording suggests, or escape each frontmatter scalar the way the description path does.

### IN-06: The background autoupdate pass does not refresh the option variables

**File:** `extensions/pi-claude-marketplace/index.ts:313-327` vs `:343-353`
**Issue:** `applyAgain` runs only inside `runForeground`, which wraps `/claude:plugin` commands. The background pass (`createBackgroundPass`) can update a plugin or install missing dependencies. That restages `mcp-adapter.json`, possibly with a new option key or a changed default. The process variables stay stale until the next foreground command or `/reload`. The comment "after every command ... so an install is usable before the next `/reload`" does not cover this path.
**Fix:** Call `applyOptionVariablesWith(optionVariables.applyAgain)` when a background pass ends, or note that the pass relies on `/reload`.

### IN-07: The load's option apply can be skipped, which leaves names inherited for an untrusted project in place

**File:** `extensions/pi-claude-marketplace/index.ts:215`, `:231`; `extensions/pi-claude-marketplace/orchestrators/plugin-options.ts:107-110`
**Issue:** The factory applies the user scope and keeps the project names of the inherited `PI_CLAUDE_MARKETPLACE_OPTIONS` ledger. A Pi started from another Pi's bash tool or from pi-subagents inherits those names and values. Only `applyForLoad` removes them for an untrusted project. That call is the last step of `prepareResources`, after an unguarded `requireNotificationMode(ctx.mode)` at `:215`, so a throw there skips it. The values from the parent stay set, against D-PG10-23's "removed when it is false". The trigger is narrow.
**Fix:** Call `applyForLoad` in its own `try`/`finally` right after the trust read at `:181`, before the mode guards. Or make the factory apply remove the project names (`{ kind: "remove" }`) rather than keep them, since the factory has no trust answer.

### IN-08: Impossible-state guard: the unsafe-character replace in `hookOptionVariableName` can never change a key

**File:** `extensions/pi-claude-marketplace/domain/user-config.ts:105`, `:308-310`
**Category:** necessity
**Issue:** Every key that reaches `hookOptionVariableName` comes from `resolveOptions` over a schema that `parseUserConfig` admitted. `parseUserConfig` rejects any key that fails `^[A-Za-z_]\w*$` (`:246`), and `recordedOptionsOf` parses the stored value again (`state-io.ts:359`). In JavaScript, `\w` is exactly `[A-Za-z0-9_]`, so `HOOK_NAME_UNSAFE` never matches. The code is kept verbatim from upstream, which is a judgment call for step 2, so this is Info.
**Fix:** Keep the replace with a comment that it is dead for parsed keys and only mirrors upstream, or drop it and the eslint suppression on `:104`.

---

_Reviewed: 2026-11-15T19:54:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
