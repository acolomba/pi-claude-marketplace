# Phase 10: Claude Settings Import Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-13T21:06:42-04:00
**Phase:** 10-Claude Settings Import Foundation
**Areas discussed:** Settings discovery paths, Merge semantics, Malformed settings policy, Marketplace source mapping

---

## Gray Area Selection

| Option | Description | Selected |
| --- | --- | --- |
| Settings discovery paths | Exact user/project Claude settings locations and missing-file behavior. | ✓ |
| Merge semantics | How `settings.local.json` overrides `settings.json`, especially object replacement vs per-key merge. | ✓ |
| Malformed settings policy | Warn vs error for malformed JSON, malformed plugin refs, and non-true values. | ✓ |
| Marketplace source mapping | Behavior for unsupported `extraKnownMarketplaces` source shapes and missing marketplace source info. | ✓ |
| All of the above | Recommended because these are the decisions planners need. | ✓ |

**User's choice:** 5 - all areas.

---

## Settings Discovery Paths

| Option | Description | Selected |
| --- | --- | --- |
| Standard Claude Code defaults | User: `~/.claude/settings.json` + `~/.claude/settings.local.json`; Project: `<cwd>/.claude/settings.json` + `<cwd>/.claude/settings.local.json`. | ✓ |
| Configurable roots via test/dependency injection only | Same production paths as standard defaults, with a pure path resolver seam for tests. |  |
| Something else | User specifies exact paths or special lookup behavior. |  |

**User's choice:** 1 - standard Claude Code defaults.

**Follow-up:** User asked whether Claude has a `CLAUDE_HOME`-style override. Investigation of `claude --help` and Claude Code 2.1.116 binary strings found `CLAUDE_CONFIG_DIR` (not `CLAUDE_HOME`) plus setting-source text for `user`, `project`, and `local`. Context was updated so Phase 10 respects `CLAUDE_CONFIG_DIR` for the user settings home and uses it as a testing seam.

---

## Merge Semantics

| Option | Description | Selected |
| --- | --- | --- |
| Shallow object merge for known sections | For `enabledPlugins` and `extraKnownMarketplaces`, merge entries by key; local values override same keys. | ✓ |
| Whole-section replacement | If local defines `enabledPlugins`, it replaces the entire base object; same for `extraKnownMarketplaces`. |  |
| Deep recursive merge | Recursively merge all objects, including nested marketplace source objects. |  |

**User's choice:** 1 - shallow object merge for known sections.

---

## Malformed Settings Policy

| Option | Description | Selected |
| --- | --- | --- |
| Warn-and-continue wherever possible | Missing files empty; malformed JSON records diagnostic; malformed refs skipped; non-true values ignored or noted. | ✓ |
| Malformed JSON blocks that scope only | Malformed JSON means no plan for that scope, while other scopes continue. |  |
| Fail fast on malformed JSON | Any malformed settings file aborts the foundation plan. |  |

**User's choice:** 1 - warn-and-continue wherever possible.

### Non-true enabledPlugins value handling

| Option | Description | Selected |
| --- | --- | --- |
| Silently ignore non-true values except malformed refs | `false`/non-true values are normal settings state; only malformed keys are reported. |  |
| Report all non-true values as informational warnings | More audit detail, but noisier. |  |
| Report only suspicious non-true values | `false` is silent; non-boolean values are warnings. | ✓ |

**User's choice:** 3 - `false` is silent; non-boolean values are warnings.

---

## Marketplace Source Mapping

| Option | Description | Selected |
| --- | --- | --- |
| Map only supported Claude source shapes; warn for the rest | `directory` -> Pi path-source add, `github.repo` -> Pi GitHub-source add; unsupported/missing source info warns and dependent plugin action is unavailable/skipped. | ✓ |
| Attempt broad parsing of any source-looking value | Try feeding strings/URLs into existing Pi `parsePluginSource`, warning only if that fails. |  |
| Require exact supported source shape | Unsupported source shape is an error for that marketplace and blocks all plugin refs using it in that scope. |  |

**User's choice:** 1 - because it is the same patterns Pi supports.

---

## the agent's Discretion

- Exact diagnostic type names and fields.
- Exact module/file placement for the pure planning foundation.
- Exact test seam style for injecting settings roots or file contents.

## Deferred Ideas

None.
