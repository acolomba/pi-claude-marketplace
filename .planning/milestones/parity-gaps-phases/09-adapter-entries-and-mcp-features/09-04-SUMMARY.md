---
phase: 09-adapter-entries-and-mcp-features
plan: "04"
subsystem: bridges/mcp adapter entries, cucumber MCP lifecycle scenarios
status: complete
tags: [mcp, pi-mcp-adapter, carried-fields, caFile, protocolVersion, cucumber]
requires: [09-03]
provides:
  - "`CARRIED_FIELDS` with `protocolVersion`, `tasks`, `exposeResources`, and `caFile` after `roots` (D-PG9-05)"
  - "the Given `the user has written these fields on the mcp server {string} in the mcp-adapter.json file of the {word} scope:` (a JSON object doc string)"
  - "three `@adapter-only` scenarios in `features/mcp-server/lifecycle.feature`"
affects: [09-05, 09-06]
tech-stack:
  added: []
  patterns: [one carried set drives carry-forward, choice store, uninstall restore, and override-kept notice]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - test/bridges/mcp/adapter-entry.test.ts
    - features/step_definitions/mcp-server/lifecycle.steps.ts
    - features/mcp-server/lifecycle.feature
decisions:
  - "`protocolVersion`, `tasks`, `exposeResources`, and `caFile` join the carried set after `roots`. No credential-bearing field joins it (D-PG9-05)."
metrics:
  duration: about 45 minutes
  completed: 2026-11-14
requirements: [PG-MCP-09, PG-MCP-06, PG-SEC-03]
actuals:
  tokens: 5200
  tasks: 2
  commits: 2
plan_head_before: fc264060251c8847b94d6ad036fb15526b9b35ac
plan_head_after: eab79782a71af3a80466042b07c98cddc222c08e
---

# Phase 9 Plan 04: User Adapter Fields Summary

A `protocolVersion`, `tasks`, `exposeResources`, or `caFile` that a user writes on a plugin
server's `mcp-adapter.json` entry now survives `/claude:plugin update`, an update that changes
the server's `url`, and `/claude:plugin reinstall`. The marker records none of them. The change
is four names appended to `CARRIED_FIELDS`. Because one set drives the carry-forward, the choice
store, the uninstall restore, and the override-kept notice, all four paths follow. A new scenario
shows that a user's `lifecycle` and `openUi` survive an update, and that a sibling server keeps
the recorded defaults.

## Commits

| Task | Commit | Title |
|------|--------|-------|
| 1 | `4640737a` | feat(mcp): keep a user's protocolVersion, tasks, exposeResources, caFile |
| 2 | `eab79782` | test(mcp): pin a user's lifecycle and openUi across a plugin update |

Both commits passed the full hook, `npm run check:commit` included. The root-pin guard passed
before the first edit and before each commit. PLAN_BASE was `fc264060`.

## Task 1: red and green

**Red, scenarios** (the new Given and both scenarios, product unchanged):
- Command: `npx cucumber-js --profile adapter --name "PG-MCP-09, D-PG9-05" features/mcp-server/lifecycle.feature`
- Result: exit 1, `2 scenarios (2 failed)`, `26 steps (24 passed, 2 failed)`.
- Both failed at `Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:`.
- Each diff removed only the four lines `"protocolVersion": "auto"`, `"tasks": true`,
  `"exposeResources": false`, and `"caFile": "/etc/pki/user/ca-bundle.pem"`.

**Red, owner cases** (tests written, product unchanged):
- `adapter-entry.test.ts`: 75 tests, 67 passed, 8 failed.
- Failing cases:
  - "AFILE-06: of every ServerEntry key, only the carried keys take their previous values …"
    (`CARRIED_KEYS` now holds the four)
  - "AFILE-06: a previous entry's credentials, env and owned fields never reach a command-only entry"
  - "D-PG9-05: a restage keeps the user's protocolVersion, tasks, exposeResources, and caFile after roots and records none of them"
  - "D-PG9-05: an absorbed override's protocolVersion, tasks, exposeResources, and caFile become active while its credentials stay inside the marker"
  - "AFILE-06: names the inactive fields of an override of the D-PG9-05 fields beside a credential in key order"
  - "D-PG9-05: each kept protocolVersion, tasks, exposeResources, and caFile takes the live value, and one the live entry lacks is left out"
  - "AFILE-05: each kept carried field takes the live value and every other field comes from the kept override"
  - "D-PG9-05: returns the user's protocolVersion, tasks, exposeResources, and caFile in carried-set order"
- After the product edit, only the AFILE-05 case failed. Its restore literal took the four
  `live-*` values the run gave, as the plan said.

**Green:**

| Check | Result |
|-------|--------|
| adapter `--name "PG-MCP-09, D-PG9-05"` | exit 0, 2 scenarios (2 passed), 26 steps (26 passed) |
| `adapter-entry`, `stage`, `adapter-doc`, `unstage` tests and `mcp-override-lifecycle` integration test | exit 0, 306 tests, 306 passed, 0 failed, 0 cancelled |
| `npm run test:coverage:direct -- …/bridges/mcp/adapter-entry.ts` | exit 0 |
| `npm run check:features` | exit 0, no "Feature gate failed" |
| `npm run test:integration` (the staged entries changed) | exit 0 |
| `npx tsc --noEmit -p .`, `eslint --max-warnings 0` on the three changed TypeScript files | exit 0 |

The caller owner tests passed with no change, as research expected.

## Task 2: wrong-precedence proof

- On arrival: `--name "A lifecycle and an openUi the user wrote for a plugin server survive an update"`
  gave exit 0, 1 scenario (1 passed), 14 steps.
- Temporary edit, in the working tree only: in `defaultFieldsFor`, the filter became
  `([field]) => !Object.hasOwn(translated, field)`. With this edit, a default replaces the
  user's carried value.
- Run with the edit: exit 1, `1 scenario (1 failed)`, `14 steps (13 passed, 1 failed)`.
  - Failing step: `Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:`.
  - Diff of the `kept` entry: `"lifecycle": "lazy-keep-alive"` in place of `"lazy"`, and the
    marker's `defaultFields` gained `"lifecycle": "lazy-keep-alive"`.
- Restore: `git checkout -- extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`.
  After it, `git diff --quiet HEAD -- extensions` exited 0.
- After the restore:
  - the named scenario: exit 0, 1 scenario (1 passed)
  - `test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature`: exit 0,
    16 scenarios (16 passed), 231 steps
  - `--profile builtin`: exit 0, 8 scenarios (8 passed), 117 steps
- `git log fc264060..HEAD --name-only -- extensions` lists only `4640737a`.

## The new Given

```ts
Given(
  "the user has written these fields on the mcp server {string} in the mcp-adapter.json file of the {word} scope:",
  async function (this: ScenarioWorld, key: string, scope: string, fieldsText: string) {
    const fields: unknown = JSON.parse(fieldsText);
    if (!isRecord(fields)) {
      throw new Error(`the user's fields are not a JSON object: ${fieldsText}`);
    }

    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, fields);
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);
```

`isRecord` is a local three-line guard, the same shape that `sources.steps.ts` and
`listing.steps.ts` define.

## Lines for later plans

- **`CARRIED_FIELDS` as the code now holds it:** `disabled`, `approveTools`, `includeTools`,
  `excludeTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `debug`, `searchKeywords`,
  `openUi`, `trace`, `appendStructuredContent`, `roots`, `protocolVersion`, `tasks`,
  `exposeResources`, `caFile`.
- For `docs/mcp-compatibility.md` (09-05), the carried-field list near `:356`: these 17 names.
  `caFile` replaces the default roots for that entry, so after a `url` change the new origin
  must chain to the user's bundle, or the connection is refused (T-09-15, accepted).
- Hash note, read from source and not measured:
  - pi-mcp-adapter 7.0.1 `computeServerHash` and pi-subagents 0.88.1 `computeMcpServerHash`
    both hash `protocolVersion` and `exposeResources`.
  - Neither hashes `tasks` or `caFile`.
  - So a carried value of any of the four opens no new agent-grant mismatch of the `openUi`
    kind (D-PG9-07 amendment).

## Deviations from Plan

1. **[D-PG9-07 amendment] The `openUi` default is withheld.** The Task 2 scenario was adapted
   in two ways:
   - The `plain` entry holds two recorded defaults, `requestTimeoutMs` and `lifecycle`, not
     three.
   - The `kept` entry's user `openUi: true` beats no default today, because there is none. The
     scenario proves the `openUi` carry. The wrong-precedence proof shows only the `lifecycle`
     half.

   The title keeps "PG-SEC-03", as the acceptance criterion requires. The orchestrator may
   want to drop it from the title, as 09-03 dropped PG-SEC-03 from its own scenario title.
2. **[Rule 1, same update rule] Changed existing expectations in `adapter-entry.test.ts`:**
   - "AFILE-06: a previous entry's credentials, env and owned fields never reach a
     command-only entry" now expects the four `previous-*` values from `fullEntry`. `caFile`
     is not a credential (D-PG9-05).
   - The AFILE-05 restore literal took the four `live-*` values.
   - The absorbed-override case "AFILE-06: an absorbed override's credentials stay inside the
     marker …" no longer holds `caFile` (Pitfall 5).
3. **Test additions beyond the behavior list:**
   - a shared `USER_ADAPTER_FIELDS` constant
   - one `inactiveOverrideFields` row showing that the four are no longer inactive beside a
     credential

   No case was deleted, skipped, or weakened.
4. **Feature description wording:** it says "survives an update and a reinstall". The plan's
   "each plugin verb" would say more than these scenarios show.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-09-14 (mitigated): only the four non-credential names joined `CARRIED_FIELDS`. The case
  "D-PG9-05: an absorbed override's … become active while its credentials stay inside the
  marker" asserts that `env`, `headers`, `bearerToken`, `bearerTokenEnv`, `bearerTokenStore`,
  `oauth`, and `auth` appear only in `keptOverride`.
- T-09-15 (accepted): a carried `caFile` survives a `url` change and can only narrow trust.
- T-09-16 (mitigated): the closed table is unchanged. The hostile every-key case still drops
  all four from the plugin's entry, and `pluginSetFieldsIn` reads only the translated entry.
- T-09-17 (mitigated): the temporary edit was restored with `git checkout`. Afterwards,
  `git diff --quiet HEAD -- extensions` exited 0, and only `4640737a` touches `extensions/`.
- T-09-SC: no package installs.

## Parent-owned lines requested

- **REQUIREMENTS.md:** PG-MCP-09 is complete: the product change, owner cases, and update
  and reinstall scenarios. PG-MCP-06 now also has the user-lifecycle update scenario.
  PG-SEC-03 stays open, as 09-03 left it: only the carry of a user's `openUi` is shown.
- **STATE.md / ROADMAP.md:** plan 09-04 is complete, with 2 tasks and 2 commits. Decision
  line: the `decisions` entry in this frontmatter.
- **09-VALIDATION.md:**
  - Red-green rows: the two PG-MCP-09 scenarios (red at the file-text step).
  - The D-PG9-03 user lifecycle and openUi scenario is a guard that passes on arrival. It was
    shown able to fail under a wrong precedence (lifecycle half only).

## Self-Check: PASSED

- FOUND: all four modified files.
- FOUND: `4640737a` and `eab79782` are ancestors of HEAD. `git rev-list --count fc264060..HEAD`
  is 2.
