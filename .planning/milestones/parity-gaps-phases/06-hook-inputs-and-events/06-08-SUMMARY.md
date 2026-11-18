---
phase: 06-hook-inputs-and-events
plan: "08"
subsystem: hooks
tags: [hooks, user-prompt-expansion, admission, matcher, translator, cucumber]
status: complete
requires: ["06-03", "06-05", "06-06", "06-07"]
provides:
  - "`UserPromptExpansion` in `ClaudeHookEvent` (shared/concerns/hooks.ts) and last in `ADMITTED_EVENT_NAMES` / `BUCKET_A_EVENTS` (domain/components/hook-events.ts); `NON_TOOL_EVENT_FIELDS.UserPromptExpansion = \"command_name\"`"
  - "`parseNameMatcher(raw: string): ParsedMatcher` (domain/components/hooks/matcher.ts, re-exported by domain/components/hooks.ts)"
  - "`ParsedMatcher` kind `{ kind: \"name-set\"; names: ReadonlySet<string> }`"
  - "`UserPromptExpansionEvent`, `UserPromptExpansionStdin`, `translateUserPromptExpansion(event, ctx)` (bridges/hooks/payloads/user-prompt-expansion.ts)"
  - "`UserPromptExpansion` in the `Exclude` of `CompositeDispatchEvent` (bridges/hooks/dispatch.ts); plan 06-10 removes it"
affects: ["06-10 (handler, notices, registration)", "06-11 (effort case of the translator)", "06-12 (resolver, dispatch scenarios)", "06-13 (compatibility page, CHANGELOG)"]
tech-stack:
  added: []
  patterns:
    - "one shared pattern parse (`parsePattern`) and list split (`exactListMembers`) under two matcher parses, tool and name"
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts
    - test/bridges/hooks/payloads/user-prompt-expansion.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/domain/components/hooks.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/rewake-text.ts
    - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
    - features/hook/configuration.feature
    - "the 16 test files of the plan's list"
decisions:
  - "D-PG6-21 as built: `UserPromptExpansion` is admitted; its group is kept at install, and only an expression that does not compile drops it, as `regex`."
  - "D-PG6-19 as built: the matcher is parsed by `parseNameMatcher`, the tool-matcher rules with no tool map; `prompt` is rebuilt from `command_name` and `command_args` as Claude Code 2.1.323 builds it."
metrics:
  duration: "about 55 min"
  completed: 2026-11-14
actuals:
  tokens: 14000
  tasks: 1
  commits: 1
plan_head_before: cd00da8c6fbad35fe3984492957562e9b28f1e92
plan_head_after: edaeda308d96115e1260807e8cae4d3329351250
---

# Phase 6 Plan 08: Admit UserPromptExpansion Summary

`UserPromptExpansion` is now an admitted hook event. A plugin's group under it is kept at install, `info` reads the plugin `available`, and an install needs no `--partial` for it. Its matcher is parsed on the command name (an exact name list or a regular expression), the new translator builds Claude Code's stdin, and every table keyed by the event set answers for it. No handler dispatches the event yet: `CompositeDispatchEvent` leaves it out, and the bridge still registers 13 Pi events.

## Commit

| Task | Commit | Title |
|---|---|---|
| 06-08-01 | `edaeda30` | `feat(hooks): admit the UserPromptExpansion hook event` |

`git rev-list --count cd00da8c..HEAD` = 1. Before the commit I ran `SKIP=npm-check pre-commit run --files <the 29 files>`. Every hook passed, and no fixer changed a file. Then I ran `git add -- <29 paths>` and `git commit -F - -- <29 paths>`. The hook log shows `npm run check:commit ... Passed` in the pre-commit pass. The commit holds exactly the 29 files of the plan's list. It deletes no file and adds no suppression marker or complexity override (`git diff HEAD~1 | grep '^+.*(fallow-ignore|eslint-disable|thresholdOverrides)'` = 0). I did not use `--amend`, `--no-verify`, `git stash`, or `git add -A`. features/hook/configuration.feature is the only file under features/ in the commit. bridges/hooks/hook-labels.ts, wire-protocol.ts, routing-state.ts, event-adapters.ts, translation-context.ts, test/architecture/hooks-lifecycle.test.ts, and test/index.test.ts are not in it.

## Red and green runs of the two scenarios

Scenarios added to features/hook/configuration.feature, after the Outline "Info on a plugin with a hook on an event pi does not support names the event unsupported". Both use existing steps only:

- "Info on a plugin with a UserPromptExpansion hook names the plugin available": one hook group, `UserPromptExpansion`, matcher `demo:deploy`.
- "A plugin whose only hook listens to UserPromptExpansion installs without --partial".

**Red** (unchanged tree: `git diff --quiet HEAD -- extensions` was 0): `npm run test:cucumber:profile -- --profile adapter features/hook/configuration.feature --name "UserPromptExpansion"` gave exit 1, `2 scenarios (2 failed)`, `19 steps (16 passed, 1 skipped, 2 failed)`.
- info: `plugin components hooks` read `[{"kind":"lenient","event":"UserPromptExpansion","supported":false}]`, `plugin reasons` read `unsupported hooks`, and `plugin status` read `partially-available`.
- install: `severity` read `error`, `needs reload` read `false`, and the result had `summary` `A plugin operation has failed.` The refusal row with the `partial-install` hint was not reached, because the first `Then` failed.

**Green** (after the change): the same command gave exit 0, `2 scenarios (2 passed)`, `19 steps (19 passed)`.

## Tables the new event forced, with the answer given

| Table | File | Answer |
|---|---|---|
| `ADMITTED_EVENT_NAMES` (and the coverage proof) | domain/components/hook-events.ts | `"UserPromptExpansion"`, last |
| `NON_TOOL_EVENT_FIELDS` | domain/components/hook-events.ts | `"command_name"` |
| `NON_TOOL_EVENT_CLOSED_SETS` key type | domain/components/hook-events.ts | the event is named in the `Exclude`, so it has no closed set |
| `CHILD_EVENT_POLICY` | bridges/hooks/event-router.ts | `"suppress"` (D-PG6-18) |
| `TRANSLATORS` | bridges/hooks/dispatch-exec.ts | `translateUserPromptExpansion` |
| `REQUIRED_EVENT_FIELDS` | bridges/hooks/dispatch-exec.ts | `["command_name", "command_args"]` |
| `TRANSLATORS` | bridges/hooks/async-rewake/registry.ts | `translateUserPromptExpansion` |
| `MATCH_FIELDS` | bridges/hooks/async-rewake/rewake-text.ts | `undefined` (the label is the event alone) |
| `BLOCKING_EVENT_DEFAULT_SECONDS` | bridges/hooks/timeout.ts | `undefined` (the 600 s default) |
| the five switches of `dispatch.ts` (`showsSystemMessages`, `blockNotices`, `showsFailures`, `adaptForEvent`, `matchValue`) | bridges/hooks/dispatch.ts | no arm: the event is named in the `Exclude` of `CompositeDispatchEvent` |
| `matcherFiresOnToolEvent` (forced by the new matcher kind) | bridges/hooks/dispatch.ts | `name-set` answers `false`, beside `invalid-pattern` and `unmapped` |
| `LOCAL_DISPATCHABLE`, `EVENT_TO_KEBAB`, `EVENT_TO_TRANSLATOR_EXPORT`, and the two expected lists | test/architecture/hooks-translators.test.ts | the event, `"user-prompt-expansion"`, `"translateUserPromptExpansion"` |
| the event count | test/architecture/closed-set-enrollment.test.ts | 11, with a D-PG6-21 comment |
| the inventory and the defensive bucket list | test/bridges/hooks/event-router.test.ts | the event's bucket, sorted before `UserPromptSubmit` |

These sets are not compile-forced, and I left them unchanged as the plan says: `PLAIN_CONTEXT_EVENTS` (wire-protocol.ts, plan 06-10), `showsSystemMessages` and `showsFailures` (they get no arm while the `Exclude` names the event). bridges/hooks/if-field/index.ts needs no code: the event is no tool event, so `compileIfPredicate` gives `tool-less-event`. Only its header comment changed.

## Listed test files that needed no edit

None. Each of the 16 test files of the plan's list changed. test/bridges/hooks/wire-protocol.test.ts and test/index.test.ts, which the verify command also runs, were not edited, as the plan says.

## As built

**Matcher (domain/components/hooks/matcher.ts).** `parsePattern(raw)` is module-private. It gives `match-all` for `""` and `*`, `undefined` for a text of only the safe characters, and otherwise `regex` (`new RegExp(raw)`, no flags) or `invalid-pattern`. `exactListMembers(raw)` splits on `|` or `,`, trims each member, and drops empty members. `parseMatcher` now uses both and keeps its tool map and its debug line. `parseNameMatcher(raw)` returns `parsePattern(raw) ?? { kind: "name-set", names: new Set(exactListMembers(raw)) }`. Members are kept as written: case-sensitive, not normalized, and not mapped to a tool (`Bash` stays `Bash`).

**Partition.** `nonToolMatcherCondition` answers for the event before it reads the closed sets: `parseNameMatcher(rawMatcher).kind === "invalid-pattern" ? "regex" : null`. `""` and `*` return earlier, in `matcherCondition`.

**Router.** The new module-private `routedMatcher(claudeEvent, rawMatcher)` returns `parseNameMatcher` for the event. For `UserPromptSubmit` and `Stop` it returns `parseMatcher("")`, and for the other events `parseMatcher(rawMatcher)`. `pushGroupHandlers` calls it. The router registers nothing new.

**Translator.**

```typescript
export interface UserPromptExpansionEvent {
  readonly command_name: string;
  readonly command_args: string;
  readonly command_source?: string;
  readonly input: InputEvent; // not read by the translator; plan 06-10 reads it
}
export interface UserPromptExpansionStdin {
  readonly session_id: string; readonly transcript_path: string; readonly cwd: string;
  readonly hook_event_name: "UserPromptExpansion"; readonly expansion_type: "slash_command";
  readonly command_name: string; readonly command_args: string;
  readonly command_source?: string; readonly prompt: string;
}
export function translateUserPromptExpansion(
  event: UserPromptExpansionEvent,
  ctx: TranslationContext,
): UserPromptExpansionStdin;
```

`prompt` is `/<command_name>` when `command_args` is `""`, else `/<command_name> <command_args>`. `command_source` is spread in only when it is defined. The stdin holds no `effort`, `permission_mode`, `session_title`, `model`, `agent_id`, or `agent_type`, also from a context that holds a title, a model, and a child identity.

## Cases added

- matcher.test.ts, `describe("parseNameMatcher")`: `""` and `*` give match-all. `deploy, ship | test` gives a name set of three. `Bash,,Deploy|` gives `{Bash, Deploy}`, with no tool map. `demo:deploy` gives `/demo:deploy/`, which matches `demo:deploy` and `demo:deploy-all` but not `deploy` or `Demo:Deploy`. `^claude-security:claude-security$` matches only that name. `[` gives invalid-pattern.
- partition.test.ts: an exact list, a regular expression, and an empty matcher are kept. `[` is dropped as `{ kind: "group", event: "UserPromptExpansion", matcher: "[", cond: "regex" }`.
- hooks.test.ts: `parseHooksConfig` keeps a wrapped `UserPromptExpansion` group, with `dropped: []`.
- hook-events.test.ts, shared/concerns/hooks.test.ts: the tuple and the field table, and the union pin.
- user-prompt-expansion.test.ts (new): the whole payload and its key order; no arguments; no source; a full context.
- dispatch-exec.test.ts: a `TRANSLATOR_CASES` row. Through it, the exact stdin bytes, the session facts (the event takes none), and the required-field probe: omitting `command_name` writes one debug line `[hooks] buildPayload: UserPromptExpansion event missing required field "command_name"; partial envelope likely`, the same holds for `command_args`, and omitting `command_source` writes none.
- registry.test.ts: a background hook of the event receives the translator's stdin.
- rewake-text.test.ts: a payload with `command_name` gives the label `UserPromptExpansion`.
- timeout.test.ts: the blocking default is 600.
- event-router.test.ts: a new routing case. `""` and `*` give match-all, an exact list gives a name set, `demo:deploy` gives a regex, and a PreToolUse group still gives a tool set. The policy walk is now "routes <event> by the eleven-event policy". Its expectation moved into `policyRuns(claudeEvent, child)`, which gives `[]` for the event in a main session and in a child, from an `input` of `/demo:deploy staging`. The inventory case's title now says eleven buckets.
- dispatch.test.ts: `// @ts-expect-error UserPromptExpansion has no handler yet (D-PG6-18)` beside the four pins. A PreToolUse entry with a `name-set` matcher never runs.
- if-field/index.test.ts: the event joins the D-CF5-23 list.

## Commands (on the tree committed as edaeda30, run before the commit)

- `npx tsc --noEmit -p .`: exit 0, no output.
- The plan's owner-test command (15 files, wire-protocol.test.ts and test/index.test.ts included): exit 0, 1148 tests, 1148 pass.
- The plan's architecture command (5 files): exit 0, 26 tests, 26 pass. hooks-lifecycle.test.ts passed unedited, with 13 registrations.
- `npm run test:unpaired` (all of test/architecture/** plus the fakes): exit 0.
- Owner tests of callers outside the list (traced from the readers of `BucketAEvent`, `DispatchableEvent`, `ClaudeHookEvent`, and `ParsedMatcher`): async-answer, event-adapters, routing-state, runtime, on-failure, hook-labels, settle, and bridges/hooks/index tests, plus test/orchestrators/plugin/info.test.ts. Exit 0, 683 tests, 683 pass.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/hooks-*.test.ts`: exit 0, 16 tests, 16 pass.
- `CI=1 npm run test:coverage:direct -- <the 12 sources>`: exit 0. Every source passed at 100%: user-prompt-expansion.ts 6/6 branches, 1/1 functions, 56/56 lines; matcher.ts 35/35, 8/8, 132/132; partition.ts 39/39, 7/7, 140/140; event-router.ts 211/211, 73/73, 1513/1513; dispatch.ts 396/396, 103/103, 1607/1607; dispatch-exec.ts 57/57, 15/15, 513/513; registry.ts 244/244, 66/66, 1288/1288; rewake-text.ts, timeout.ts, hook-events.ts, hooks.ts, and shared/concerns/hooks.ts also passed at 100%.
- `npm run test:cucumber:profile -- --profile adapter features/hook/configuration.feature features/hook/matchers.feature features/hook/prompt-commands.feature`: exit 0, `28 scenarios (28 passed)`, `348 steps (348 passed)`. The builtin profile on the same three files selects 0 scenarios, because none of them is tagged for it.
- Wider guard, because the event set changes for every hook feature: `--profile adapter features/hook` gave exit 0, `267 scenarios (267 passed)`, `3650 steps (3650 passed)`. `--profile builtin features/hook` gave exit 0, `15 scenarios (15 passed)`, `237 steps (237 passed)`. No step or step text changed, and no feature names the event except configuration.feature.
- `npm run check:features`, `npm run test:corresponding`, `npm run fallow`, `npx eslint --max-warnings 0 <changed .ts files>`, and `npx prettier --check <changed .ts files>`: all exit 0.
- Acceptance greps: `"UserPromptExpansion"` in shared/concerns/hooks.ts 1, in hook-events.ts 2. `export function parseNameMatcher` 1. `parseNameMatcher` in partition.ts 2, in event-router.ts 2. `translateUserPromptExpansion` in dispatch-exec.ts 2, in registry.ts 2. `UserPromptExpansion` in dispatch.ts 2, in hooks-translators.test.ts 5, in configuration.feature 5. The dispatch.ts diff changes only the `Exclude`, its doc comment, and one `case "name-set":` line.

Node v26.13.1, Linux.

## Upstream facts

I took them from the plan's interfaces block (Claude Code 2.1.323, read in the binary on 2026-11-14) and did not read the binary again, so I record no offsets. The facts are: the runner builds `prompt` as `/<name> <args>`, or `/<name>` with no arguments; the matcher target is `command_name`, and the event is in the set whose exact lists may hold `,`, spaces, and `-`; the default timeout is 600,000 ms; the runner passes no match query, so the hook is named `UserPromptExpansion` alone.

## Deviations from Plan

### Auto-fixed Issues

None. The plan was executed as written.

### Interpretations recorded

- **The router's policy expectation is a small function.** The walk's nested ternary grew a third condition, so I moved it into `policyRuns(claudeEvent, child)` in the test. The expectations of the other ten events did not change.
- **The red install run stops at the first `Then`.** The `partial-install` hint row was not compared on the unchanged tree. The failing `severity`/`needs reload`/`summary` fields show the refusal.
- **`exactListMembers` drops empty members before the loop of `parseMatcher`.** Before, the loop skipped them with `continue`. The behavior is the same, and the existing `parseMatcher` cases pass unedited.
- **The child-policy entry carries a one-line comment** (`D-PG6-18: the event runs in the main session only.`), the only comment in that table.

## Flagged assumptions (from the plan, unchanged)

- **The admission and the dispatch are two plans.** While the `Exclude` of `CompositeDispatchEvent` names the event, the five switches of dispatch.ts need no arm. Plan 06-10 takes it out, and the compiler then asks for each arm.
- **Between this plan and plan 06-12,** the event is admitted and nothing dispatches it: a plugin's group installs and `info` reads it supported, but its hook runs for no typed line. Nothing ships between the plans. The compatibility page and the CHANGELOG change in plan 06-13 only.
- **A name set in `ParsedMatcher`.** The routing table keeps one matcher type. The cost is one `false` arm in `matcherFiresOnToolEvent` for a state the router never builds, and its owner case.
- **The notice label is `UserPromptExpansion` alone** (read in the binary, not seen in a run). This plan applies it to the label of a background hook. Plan 06-10 applies it to the notices.
- **A legacy tool name as a command name.** Claude Code runs an exact-list member through its tool alias map on every event that takes such a list. The bridge keeps the member as written. Not built.
- **`info` lists the event as it lists any supported event with no tool matcher:** `{"event":"UserPromptExpansion"}`, with no matcher member. Not changed.
- **`if` on the event** never fires (D-CF5-23), and the owner case of the rule now includes the event.
- **`prompt` is rebuilt, not copied** (pending maintainer review). For a line typed in a form only Pi has (`/skill:<generated name>`, or an alias), `prompt` names the command in Claude form and differs from the typed text. `UserPromptSubmit` still carries the line as typed.
- **Platform:** the two scenarios run `info` and `install` only. They ran on Linux only.

## Records for the orchestrator (parent-owned lines, not applied)

- PROJECT.md Key Decisions: "D-PG6-19 (pending maintainer review): a `UserPromptExpansion` matcher selects on `command_name` by the rules of a tool matcher, with no tool name map (`parseNameMatcher`). The stdin holds `expansion_type` `slash_command`, `command_name`, `command_args` (`\"\"` with none), `command_source` when one is known, and `prompt`, which is `/<command_name>` plus one space and the arguments when there are any. It holds no `effort`, no `permission_mode`, and no `session_title`." "D-PG6-21: `UserPromptExpansion` is an admitted event; a plugin that needed `--partial` only for it no longer does; an installed plugin whose group was dropped at install gets it at its next `update` or `reinstall`; a load rewrites no installation state." "D-PG6-22: `expansion_type` is never `mcp_prompt`; Pi has no slash surface for MCP prompts." Planner's finding (Claude Code 2.1.323): the event's runner passes the hook runner no match query, so a hook of the event is named `UserPromptExpansion` alone.
- `.planning/codebase/ARCHITECTURE.md` and CONVENTIONS.md: "Eleven admitted hook events (`BUCKET_A_EVENTS`), `UserPromptExpansion` last." "`ParsedMatcher` has the kind `name-set` (`names`), which `parseNameMatcher` builds for a matcher on a command name; a tool matcher never holds it." "The payload module `bridges/hooks/payloads/user-prompt-expansion.ts` (`translateUserPromptExpansion`) builds the `UserPromptExpansion` stdin from a synthetic event that holds the command's Claude-form name, its arguments, its source, and Pi's input event."
- BACKLOG.md HOOKHEAL-01: "An installed plugin whose `UserPromptExpansion` group was dropped at install gets it at its next `update` or `reinstall` (D-PG6-21); a load does not restore it."

## Known Stubs

None. The event has no handler until plan 06-10, as the plan intends: the `Exclude` of `CompositeDispatchEvent` and the policy case state it. That gap does not block this plan's goal. The plan expects it, so I recorded no `windows append` entry.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-24 (accept): a plugin's expression on `command_name` is compiled with `new RegExp` and no flags, as a tool matcher is, and an expression that does not compile drops its group at install. T-06-26 (accept): the translator sends only Claude Code's fields. T-06-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-expansion.ts
- FOUND: test/bridges/hooks/payloads/user-prompt-expansion.test.ts
- FOUND: edaeda30 (HEAD, ancestor of HEAD)
