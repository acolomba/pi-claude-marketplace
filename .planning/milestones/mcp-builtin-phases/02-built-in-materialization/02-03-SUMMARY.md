---
phase: 02-built-in-materialization
plan: "03"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, cucumber, integration, conformance]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "builtinServerConfig, BUILTIN_FIELD_ENCODER, the filled builtinRegistrationStep, the tool-search calls step (plan 02-01)"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "usePiWithProfile extraExtensions, the MCP implementation steps, the registry probe, the dual cucumber profiles"
provides:
  - "features/lib/mcp-builtin-config-probe: a harness Pi extension that reports every registered MCP server's name and whole config"
  - "the steps 'pi runs with the scripted model and a probe of the mcp servers registered with pi's built-in mcp', 'the published plugin ... has the stub mcp server ... with these fields:', and 'pi holds these mcp server configs, apart from each stdio server's command and arguments:'"
  - "builtin-values.feature and builtin-direct.feature (@builtin-only)"
  - "sources.feature under both profiles"
  - "test/integration/mcp-builtin-encoding-conformance.test.ts"
affects: [02-09]

actuals:
  tokens: 14750
  tasks: 3
  commits: 3
plan_head_before: 776a9b3501b978dfe49ac9addfa3837de4fbf623
plan_head_after: 548d8df9a0d5618bf98c661a053ce4397aad0e89

tech-stack:
  added: []
  patterns:
    - "A harness Pi extension that reports Pi's MCP registry configs as a custom entry, loaded through extraExtensions"
    - "Pi's unexported dist modules imported by absolute file URL with local interfaces"

key-files:
  created:
    - features/lib/mcp-builtin-config-probe/extension.ts
    - features/lib/mcp-builtin-config-probe/snapshot.ts
    - features/step_definitions/mcp-server/builtin-values.steps.ts
    - features/mcp-server/builtin-values.feature
    - features/mcp-server/builtin-direct.feature
    - test/integration/mcp-builtin-encoding-conformance.test.ts
  modified:
    - features/mcp-server/sources.feature

key-decisions:
  - "The conformance test drives builtinServerConfig on Claude-shaped servers, so the closed table, the walk, and the encoder run together"
  - "A written env or headers value must name no variable and be no command for Pi, so Pi reads no environment and runs no shell"
  - "The bundle scenario is @mcp: its builtin run gave the same result as the adapter run"
  - "Each built-in source twin searches the full tool name; Pi's search loads every echo tool of the plugin, and the call shows the winning declaration"

requirements-completed: [BLT-02, BLT-01]

duration: 1h 25m
completed: 2026-11-04
---

# Phase 2 Plan 03: Built-in values and encoding conformance Summary

**A harness probe reads the configs Pi's built-in MCP holds for each plugin server (timeout in seconds, deferred or direct exposure, Claude Code's OAuth fields, the plugin description, no Pi-only field), an alwaysLoad server is called on the first model call, every expansion case resolves through Pi 1.5.0's own resolver and validator, and sources.feature runs under both profiles.**

## Performance

- **Duration:** about 1 h 25 min
- **Completed:** 2026-11-04
- **Tasks:** 3 of 3
- **Files:** 7 (6 created, 1 modified)

## Accomplishments

- `features/lib/mcp-builtin-config-probe/` holds a Pi extension whose command appends one custom entry with `pi.getMcpServers()` names and configs, and a reader with a typebox validator. The step `pi holds these mcp server configs, ...` runs the probe, asserts no dialog and no extension error, and compares the whole list as JSON with run tokens projected.
- `builtin-values.feature` (5 scenarios): timeout `2.5` and `deferred`; a `streamable-http` server with `type: "http"`, its headers, and the exact four-key `oauth` object (`clientId`, `callbackUrl: http://localhost:8765/callback`, `authServerMetadataUrl`, `scope`), with no `clientSecret`, `clientName`, or `clientRegistration`; no `cwd`, `toolExposure`, `enabled`, or `auth`, and the server still connects; the plugin description; `exposure: "direct"` for `alwaysLoad: true`.
- `builtin-direct.feature`: an alwaysLoad stub's tool is offered on calls 1 and 2 and the model calls it with no search (`echo:ping`).
- `test/integration/mcp-builtin-encoding-conformance.test.ts` (63 tests): all 52 `EXPANSION_CASES`, 7 Pi-syntax rows (`$HOME`, `$$`, `$!`, `!cmd`, `a$`, empty, `${A}${B}`), 3 validator rows that return the same JSON, and the unset-`${NAME}` url refusal.
- `sources.feature` has no file-level tag: 4 `@adapter-only` scenarios, 7 `@builtin-only` twins (registry lists in merge order `a, c, b` / `x, z, y` / `e, f` / `h`, and calls that return `a-manifest`, `x-fileb`, `e-entry`), and 3 `@mcp` scenarios (bundle, residual, symbolic link).

## Task Commits

1. **Task 1 (tracer): probe of Pi's registered configs** - `dda7183` (test)
2. **Task 2: OAuth, Pi-only fields, description, direct exposure, and the conformance test** - `83e73e0` (test)
3. **Task 3: built-in twins of the server-source scenarios** - `548d8df` (test)

Tracer gate: Task 1's verify (builtin profile, `check:static`) passed end to end before Task 2 started.

## TDD Gate Compliance and red runs

The product code is plan 02-01's, so each red run restores `orchestrators/mcp/builtin-registration-step.ts` to its `87d3f28` seed, runs, and checks the file out again. The reverted file was never committed.

- **Task 1, builtin profile, seed step (seed 533265):** 1 scenario, 1 failed: `the builtin mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`.
- **Task 2, builtin profile, seed step (seed 596445):** 6 scenarios, 6 failed. The OAuth scenario failed in the configs comparison (Pi held no server); the other five failed in the listing wait.
- **Task 2, conformance test, mutation:** with the secret-field escape removed from `builtin-escape.ts` (restored at once), 10 of 63 failed, such as `env value starting with ! gains one !` and `env "$HOME"`. There is no seed for this test, because `builtinServerConfig` did not exist at `87d3f28`.
- **Task 3, builtin profile, seed step (seed 605179):** 10 scenarios, 9 failed: all 7 twins and the 2 lifted `@mcp` scenarios (residual, symbolic link). The bundle scenario passed, because it needs no registration.

## Verification

- `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-values.feature features/mcp-server/builtin-direct.feature`: 6 of 6 passed.
- `sources.feature`: builtin profile 10 of 10 (seed 926398), adapter profile 7 of 7 (seed 803715).
- `node --test test/integration/mcp-builtin-encoding-conformance.test.ts`: 63 of 63.
- `npm run check:static` passed after each task (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- Bundle scenario: under the builtin profile with the plan unchanged it gave the same result as under the adapter profile (`partially-available`, `unsupported mcp`, `partial-install`), so it is `@mcp`. No parent line is needed for it.
- `fallow-ignore` markers: 45 (baseline 44). The new one is the `unused-export` marker on the probe's default export.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `no-unsafe-return` in the sentinel environment helper**
- **Found during:** Task 2 (`npm run check:static`, lint)
- **Issue:** `Object.fromEntries` over `match[1]` (typed `string | undefined`) returned `any`.
- **Fix:** A loop that fills a typed record.
- **Files modified:** `test/integration/mcp-builtin-encoding-conformance.test.ts`
- **Commit:** `83e73e0`

**2. [Plan wording] The conformance test drives `builtinServerConfig`, not `substituteAndInject` with translated field shapes**
- **Found during:** Task 2
- **Issue:** The plan names `substituteAndInject(..., BUILTIN_FIELD_ENCODER)` over substitute.test.ts's translated shapes. The production path also runs the closed table.
- **Fix:** Each case writes a Claude-shaped server (remote shapes with `type: "http"`, `oauth.scopes` for the scope case) and reads its field back from `builtinServerConfig`'s output. Every case passes, so the table drops nothing a case needs.
- **Commit:** `83e73e0`

**3. [Rule 2 - Stronger check] Pi's `getConfigValueEnvVarNames` and `isCommandConfigValue` are imported too**
- **Found during:** Task 2
- **Issue:** Pi's resolver falls back to `process.env` for an empty or unset name, so a second resolution alone does not prove that Pi reads no environment.
- **Fix:** Each written `env` or `headers` value must name no variable and must not be a command for Pi. Both resolutions must also give Claude's value.
- **Commit:** `83e73e0`

## Parent lines

- `.planning/codebase/CONVENTIONS.md` (Suppressions): the count goes from 44 to 45. Seven `unused-export` markers now cover default exports that a loader reads by name. The harness Pi extensions loaded by Pi's `--extension` loader are now five; add `features/lib/mcp-builtin-config-probe/extension.ts`.
- `.agents/skills/cucumber/rules/world-and-stand-ins.md` (frozen): optionally name the config probe beside the registry probe, as the extension a built-in values scenario loads through `extraExtensions` (P2-DC-24).
- None for the bundle scenario. It is `@mcp`, and its description now says that neither MCP implementation has a bundle runner.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-13 (Pi-only fields scenario), T-02-14 (exact four-key `oauth` row), and T-02-16 (remote values on `127.0.0.1:9`) are covered. T-02-15 is accepted: the probe is a harness extension that only `@builtin-only` scenarios load.

## Dubious Choices

**DC-A: The conformance test goes through `builtinServerConfig` rather than the bare walk**
- **Choice:** Claude-shaped servers through the table, the walk, and the encoder.
- **Alternatives:** `substituteAndInject` with the translated shapes, as planned.
- **Why dubious:** A case fails for a table defect as well as an encoder defect, so a failure points less directly at the encoder. The unit tests of each module already isolate them.
- **Severity:** Low.

**DC-B: Each source twin's tool search loads every echo tool of the plugin**
- **Choice:** The query is the full tool name, such as `mcp__plugin_demo_a__echo`. Pi's search still loads all of the plugin's echo tools, and the row lists them sorted. The call's tag (`a-manifest`) proves which declaration won.
- **Alternatives:** A query that loads one tool. The server-name query `a` loaded no tool, so the call failed with "Tool mcp__plugin_demo_a__echo not found". No query that loads exactly one tool was found.
- **Why dubious:** The row depends on Pi's search ranking, which a later Pi could change.
- **Severity:** Low.

**DC-C: The Pi-only fields scenario puts `auth.provider` on a stdio stub**
- **Choice:** One stub with `cwd` (a directory that does not exist), `toolExposure`, `enabled: false`, and `auth`. A leaked `cwd` or `enabled` would stop the server, and Pi's validator keeps every field of a stdio config, so a leaked field would show in the row.
- **Alternatives:** A second, remote scenario for `auth.provider`, where the token would actually be sent.
- **Why dubious:** It proves the table drops `auth` for a stdio server. The translation unit test covers the remote case, but no scenario does.
- **Severity:** Low.

**DC-D: The bundle scenario's description is reworded to say neither implementation has a bundle runner**
- **Choice:** An `@mcp` scenario must stay neutral, so the description names neither implementation.
- **Alternatives:** Keep it `@adapter-only` with its old wording.
- **Why dubious:** The claim about Pi rests on Pi 1.5.0 serving only stdio and streamable HTTP configs (`validateMcpServerConfig`). No Claude Code probe was run.
- **Severity:** Low.

## Self-Check: PASSED

- All created and modified files listed above exist in the worktree.
- Commits `dda7183`, `83e73e0`, and `548d8df` are ancestors of HEAD.
