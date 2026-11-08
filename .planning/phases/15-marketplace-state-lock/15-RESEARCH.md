# Phase 15: Marketplace State Lock - Research

**Researched:** 2026-11-08
**Domain:** cucumber behavioral scenarios for the per-scope proper-lockfile state lock (D-06) of the marketplace verbs
**Confidence:** HIGH. Every result row below was printed by a probe run of the current product on this machine. Both red-proof mutations were run in a scratch copy of the tree.

## Summary

The phase needs no product change and no new step module. Every step exists in a frozen shared module. I ran 22 probe scenarios against the current product with `npx cucumber-js --profile adapter --parallel 3 --order defined`, and all 22 passed with the tables given below (`final.feature` in the scratchpad). They covered:

- the MLOCK-01 Outline, 4 rows;
- the stale flip Outline, 4 rows;
- the stale add Outline, 8 rows over the 4 source kinds and 2 scopes;
- stale remove in both scopes;
- stale update in both scopes (3 rows, one repeated).

Both red proofs from D-BG-1512 work as described. I ran each one in a scratch copy of `extensions/` and `features/`, and never edited the worktree:

- **Flip without the lock** (`orchestrators/marketplace/autoupdate.ts`). The 4 MLOCK-01 rows fail at `the result has these fields:` with `severity` `info` instead of `error`. The 4 stale flip rows still pass.
- **`stale: 3_600_000`** (`transaction/with-state-guard.ts`). All 18 stale twins fail at `the result has these fields:` with `severity` `error` and the `summary` row. The 4 MLOCK-01 live rows still pass, so staleness is the only difference.

Three facts change what the planner might assume:

1. A stale `update` reports a marketplace-level row only, `skipped {up-to-date}`, with no plugin row. Pin it with `the result lists these marketplaces:` and `| name | scope | status | reasons |`.
2. After a stale `add`, the url and github kinds hold a checkout `sources/tools` and a git clone `marketplace`, and the local kinds hold neither. No existing step checks the marketplace record in `state.json` positively. So the stale add Outline can only pin the result and the config, the same Thens that `add.feature` uses.
3. `declares these marketplaces:` cannot state an absent `autoupdate` as an empty cell. Leave the column out of the table.

**Primary recommendation:** Use one plan in one wave that edits only `features/marketplace/state-lock.feature`. Add the MLOCK-01 Outline (4 rows), the stale flip Outline (4 rows), the stale add Outline (8 rows), and the three stale remove and update twins. Rewrite the seed as the project-scope remove twin. Record both red proofs with their exact diffs below, then revert each with `git checkout -- <file>`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Lock contract and upstream parity (D-BG-1501 to D-BG-1503)

- **D-BG-1501: the product keeps D-06; the feature names it.** Claude Code 2.1.319 also locks marketplace writes with proper-lockfile: it locks `known_marketplaces.json` through `<file>.lock` with `realpath: false`, 5 retries at 100 to 1000 ms, and proper-lockfile's default 10-second stale window. When it cannot take the lock, it logs `Failed to acquire known_marketplaces.json lock, writing without it` and writes anyway (grepped from `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.319/claude` on 2026-11-08, high confidence for the options, medium for the full call graph). This project's D-06 instead takes the lock with `retries: 0` and fails the verb as `lock held`, changing nothing. D-06 is a recorded project decision, so it licenses the divergence. The feature description names D-06, and the MLOCK-01 scenarios pin the D-06 behavior.
- **D-BG-1502: the stale rule matches upstream's default.** The product locks with `stale: 10_000, update: 2_000` (`transaction/with-state-guard.ts`). proper-lockfile reads a lock directory whose mtime is older than `stale` as free, removes it, and takes the lock on its one try, with no process check. Claude Code's bundled proper-lockfile has the same rule with the same 10-second default. D-BG-11 settled the fixture: a lock directory with a 60-second-old mtime. No change to `with-state-guard.ts`.
- **D-BG-1503: a takeover of a stale lock reports nothing.** A verb that takes over a stale lock reports exactly what it reports with no lock: no extra notice, reason, or warning. proper-lockfile and Claude Code take the lock over silently too. Each stale scenario pins the whole no-lock result, so an extra row or notice fails it.

#### Which verbs and forms the scenarios cover (D-BG-1504 to D-BG-1506)

- **D-BG-1504: the verbs are the five that change a scope.** `marketplace add`, `remove`, `update`, `autoupdate`, and `noautoupdate` each take the scope's state lock (`withLockedStateTransaction` in `orchestrators/marketplace/{add,remove,update,autoupdate}.ts`). `marketplace list` and `info` take no lock, so they are out of scope.
- **D-BG-1505: MLOCK-01 covers the named flip with `--scope`, for both verbs and both scopes.** One Scenario Outline has four rows (verb `autoupdate` or `noautoupdate`, scope `project` or `user`). Each row first sets the marketplace's base-config value to the opposite of what the verb asks for, so that without the lock the verb would write. The row then checks the whole failed result: the `(failed)` marketplace header and its failed child with reason `lock held` and the retry-hint cause chain. It also checks the base config's `autoupdate` value, and that the config and installation record bytes of the scope are unchanged.
- **D-BG-1506: the unnamed flip and the cross-scope flip get no scenario.** Without a name, a flip under a held lock reports the `(unknown)` aggregate subject. Without `--scope`, it writes the project scope and then fails on a held user lock (D-06 partial outcome). Unit tests in `test/orchestrators/marketplace/autoupdate.test.ts` pin both outputs on purpose. A scenario would set that wording in place for good, and the requirement names neither form. They go to Deferred Ideas.

#### Scenario shape: twins (D-BG-1507 to D-BG-1509)

- **D-BG-1507: every stale-lock scenario is the twin of a live-holder scenario.** Each stale scenario has the same `Given` steps as its live twin. Only the lock step differs: `a process that died left the state lock of the <scope> scope` in place of `another process holds the state lock of the <scope> scope`. The live twin fails as `lock held`. The stale twin completes with the whole result that the verb gives with no lock, so staleness is the only difference (MLOCK-02, success criterion 3). The twins are:
  - `marketplace remove` in the project scope and in the user scope, with `demo` installed, as the existing live scenarios set it up. The result is `removed`, and the cascade uninstalls `demo`.
  - `marketplace update` in the project scope and in the user scope, with `demo` installed. The result is `skipped {up-to-date}`.
  - `marketplace add`: one Outline over the same Examples blocks as the live add Outline (the scopes `project` and `user`; the local kinds `dir` and `file`, plus `@url` and `@github`). The result is `added`. Each row also checks the scope's config and record.
  - `marketplace autoupdate` and `noautoupdate`: one Outline over the same four rows as the MLOCK-01 Outline. The result is `autoupdate enabled` or `autoupdate disabled`, and the base config holds the new value.
- **D-BG-1508: the seed is rewritten as the remove twin.** The Phase 1 seed "Removing a marketplace while a process that died left the state lock of its scope removes it" installs no plugin (P1-DC-29). This phase rewrites it as the exact project-scope twin of the live remove scenario: `demo` installed, and the whole cascade result. The seed's lock step stays in use.
- **D-BG-1509: no `Rule:` blocks.** The live scenarios come first, as they do today, then the stale twins in the same verb order. Titles say "while another process holds" and "while a process that died left", so a reader pairs them without a `Rule:`.

#### Footprint and proof (D-BG-1510 to D-BG-1512)

- **D-BG-1510: no verb step module.** Every step the scenarios need already exists in the shared modules: `scope-state.steps.ts` (both lock steps), `config.steps.ts` (the layer config `Given`, the declarations `Then` steps, and the remembered and unchanged bytes steps), `command.steps.ts`, `marketplace/publishing.steps.ts`, `marketplace/checkout.steps.ts`, and the installation record and staging steps. The phase creates `features/step_definitions/marketplace/state-lock.steps.ts` only if a needed step turns out to be missing. If it does, the step's text names its verb (D-08).
- **D-BG-1511: no product change is expected.** The discuss-step probes ran the current product under a live and a stale lock for all five verbs. Each verb behaves as MLOCK-01 and MLOCK-02 require. If a scenario still exposes a bug, the fix stays in this phase's three product files, and a fix anywhere else becomes a parent line.
- **D-BG-1512: red proofs by a temporary product mutation, reverted before the commit.** MLOCK-01: run the flip without the scope lock in `orchestrators/marketplace/autoupdate.ts`. Its scenarios then fail, because the flip writes. MLOCK-02: raise the `stale` window in `transaction/with-state-guard.ts` (for example to one hour). The stale twins then fail as `lock held`. Each plan SUMMARY records the command, the failing scenarios, and the revert.

### Claude's Discretion

- The exact scenario titles and the `Examples` column names, under `.agents/skills/cucumber/rules/features.md`.
- Whether the MLOCK-01 Outline also uses the remembered and unchanged bytes steps, beside the explicit `autoupdate` declarations (recommended: both).
- How many plans and tasks. All the work edits one feature file, so the recommendation is one plan in one wave.

### Deferred Ideas (OUT OF SCOPE)

- An unnamed `marketplace autoupdate` or `noautoupdate` under a held lock reports the `(unknown)` aggregate subject (pinned by unit tests). It could name the recorded marketplaces, as an unnamed `marketplace update` does. That is a product wording change, so it is a candidate BACKLOG item for the parent.
- A flip without `--scope` that writes the project scope and then fails on a held user lock (the D-06 partial outcome) has no scenario.
- A lock left by a process that died less than 10 seconds ago still reads as held. A scenario for it would have to wait out the stale window.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MLOCK-01 | `marketplace autoupdate` and `noautoupdate` while another process holds the state lock fail as lock held and change nothing. | The MLOCK-01 Outline below passed on all 4 rows. It fails on all 4 rows when the flip runs without the lock (red proof A). The bytes step proves that `claude-plugins.json` and `state.json` stay unchanged. |
| MLOCK-02 | A lock file left by a process that has died does not block the marketplace verbs, as `proper-lockfile`'s stale handling defines. | The 18 stale twins below passed. They fail on all 18 with `stale: 3_600_000` (red proof B). The 4 live MLOCK-01 rows and the existing live scenarios still pass under that mutation, so staleness is the only difference. |
</phase_requirements>

## Project Constraints (from AGENTS.md and the child brief)

- Edit only `features/marketplace/state-lock.feature`. The verb module `marketplace/state-lock.steps.ts` is reserved, but D-BG-1510 says not to create it. Product edits are allowed only in `orchestrators/marketplace/autoupdate.ts`, `edge/handlers/marketplace/autoupdate.ts`, and `transaction/with-state-guard.ts`, and only for a bug a scenario exposes. None is expected.
- These files are frozen: `features/support/**`, `features/lib/**`, every existing step module, `cucumber.json`, `scripts/check-features.mjs`, `package.json`, `.agents/skills/cucumber/**` (including `layout.md`'s "Seeds" list), `eslint.config.js`, and `.fallowrc.json`.
- No scenario here has an MCP surface, so none carries an implementation tag. Each runs once, under the `adapter` profile (D-BG-04).
- Every scenario must fail without its behavior, and the plan SUMMARY records the red proof (Milestone rules, Behavioral tests).
- Git: commit only on `features/behavioral-gaps-phase-15`. Before committing, run `SKIP=npm-check pre-commit run --files <changed files>`. Never use `--no-verify`, `--amend`, or a rebase. Commit titles carry no phase, plan, or wave ID.
- Use a hermetic home: the cucumber harness gives every scenario a sandbox home. None of the probes in this research changed anything under the real `~/.pi`. I checked this with `find /home/acolomba/.pi -newer <probe file>`, which found nothing.
- The plan SUMMARY needs `## Threat Flags` ("None") and `## Dubious Choices`.
- Gates: the wave and phase gates run `npm run check` on the combined tree. The phase gate also runs `npm run test:modules`. A passing commit hook does not satisfy a gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Taking and refusing the scope lock | `transaction/with-state-guard.ts` (`acquireStateLock`) | proper-lockfile 4.1.2 | It is the single lock chokepoint (D-06). It maps `ELOCKED` to `StateLockHeldError`. |
| Mapping the lock failure to `lock held` for a flip | `orchestrators/marketplace/autoupdate.ts` (`autoupdateFailedReason`, `flipOneScope`) | `shared/notification-*` | The orchestrator owns the failed row and its reason. |
| Simulating a live holder and a dead holder | `features/lib/state-lock-holder.ts` (frozen) | `scope-state.steps.ts` (frozen) | The test stand-ins already exist. |
| The behavior pins | `features/marketplace/state-lock.feature` | none | This is the only file this phase edits. |

## Standard Stack

The phase installs no package and adds no library.

| Tool | Version | Purpose |
|------|---------|---------|
| `@cucumber/cucumber` | from `package-lock.json` (frozen) | Runs the scenarios. |
| `proper-lockfile` | 4.1.2 `[VERIFIED: node_modules/proper-lockfile/package.json:3 "version": "4.1.2"]` | The lock that the product and the holder child both use. |
| Node | v26.13.0 locally (CI uses 24) | Runs the tests. |

## Package Legitimacy Audit

Not applicable: the phase installs no external package.

## Architecture Patterns

### How a lock reaches the result

```
Given another process holds ...   -> child process: lockfile.lock(extensionRoot, {retries:0, stale:10_000, update:2_000})  (lock refreshed every 2 s)
Given a process that died left ... -> mkdir <extensionRoot>/.state-lock ; utimes(now - 60 s)
When the user runs "/claude:plugin marketplace <verb> ..."
   -> orchestrator -> withLockedStateTransaction -> acquireStateLock -> lockfile.lock(retries: 0, stale: 10_000)
        EEXIST + mtime fresh  -> ELOCKED -> StateLockHeldError -> failed row {lock held}, severity error, nothing written
        EEXIST + mtime > 10 s old -> rmdir lock, retake -> verb runs exactly as with no lock -> normal result
Then result / config / record / bytes steps
```

### Verified in-repo values

- The product lock options `[VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:212-217]`:
  ```
      release = await lockfile.lock(locations.extensionRoot, {
        lockfilePath: locations.stateLockFile,
        realpath: false,
        retries: 0,
        stale: 10_000,
        update: 2_000,
  ```
- The age of the dead holder's lock `[VERIFIED: features/lib/state-lock-holder.ts:33-35]`:
  ```
  // The age of a lock a dead holder left: six times the product's stale window,
  // so the lock never sits on the boundary of proper-lockfile's comparison.
  const STALE_LOCK_AGE_MS = 60_000;
  ```
- The stale rule `[VERIFIED: node_modules/proper-lockfile/lib/lockfile.js:84-86]`: `return stat.mtime.getTime() < Date.now() - options.stale;`. A stale lock is removed with `rmdir`, and the lock is taken again with `stale: 0` (lines 71-79). There is no process check.
- The flip runs under the lock `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:536-549]`:
  ```
  async function flipOneScope(opts: AutoupdateOptions, scope: Scope): Promise<FlipPlan> {
    const locations = locationsFor(scope, opts.cwd);
    return await withLockedStateTransaction(locations, async (tx) => {
      const plan =
        opts.name === undefined
          ? await planEveryFlip(opts, locations, tx.state)
          : await planNamedFlip(opts, locations, tx.state, opts.name);
      if (opts.notifications?.mode !== "orchestrated") {
        await writeFlipPlan(plan, locations.scopeRoot, opts.enable);
      }

      return plan;
    });
  }
  ```
  A named flip needs the marketplace in `state.json` (`if (ownValue(state.marketplaces, name) === undefined) { throw new MarketplaceNotFoundError(name, []); }`). It also needs the target layer to declare it (`requireTargetDeclares`).

### Steps the scenarios use (all existing, so D-BG-1510 holds)

| Step text (verbatim) | Module |
|---|---|
| `the marketplace {string} is published as a {source kind} source` | `features/step_definitions/marketplace/publishing.steps.ts:62` |
| `the marketplace {string} offers these plugins:` | `marketplace/publishing.steps.ts:137` |
| `the marketplace {string} is added to the {word} scope` (runs the real `marketplace add` and asserts `severity` `info`) | `marketplace/publishing.steps.ts:195` |
| `the user has run {string}` | `command.steps.ts:91` |
| `a config in scope {word} and layer {word}, with these marketplaces:` | `config.steps.ts:177` |
| `the config and installation record bytes of the {word} scope are remembered` | `config.steps.ts:170` |
| `another process holds the state lock of the {word} scope` | `scope-state.steps.ts:17` |
| `a process that died left the state lock of the {word} scope` | `scope-state.steps.ts:29` |
| `the user runs {string}` | `command.steps.ts:123` |
| `the result has these fields:` | `command.steps.ts:158` |
| `the result lists these plugins:` | `command.steps.ts:166` |
| `the result lists these marketplaces:` | `command.steps.ts:173` |
| `the {string} file of the {word} scope declares these marketplaces:` | `config.steps.ts:227` |
| `the config and installation record bytes of the {word} scope are unchanged` | `config.steps.ts:240` |
| `the {string} file of the {word} scope declares these plugins:` | `config.steps.ts:249` |
| `the {string} file of the {word} scope declares no marketplaces` | `config.steps.ts:273` |
| `the {string} file of the {word} scope declares no plugins` | `config.steps.ts:282` |
| `the installation record of the {word} scope holds these plugins:` | `plugin/installation.steps.ts:417` |
| `the installation record of the {word} scope holds no plugins` | `plugin/installation.steps.ts:432` |
| `the {word} scope stages these skills and prompts:` | `plugin/installation.steps.ts:404` |
| `the {word} scope holds no marketplace record` | `marketplace/checkout.steps.ts:58` |
| `the {word} scope holds no marketplace checkout` / `the {word} scope holds no git clones` / `the "claude-plugins.json" file of the {word} scope does not exist` | existing live add Outline (unchanged) |

### Facts about the steps that the planner needs

- **The layer config `Given` keeps the record.** `writeLayerMarketplaces` replaces only the `marketplaces` member of the one config file and never touches `state.json` `[VERIFIED: features/lib/layer-config.ts:143-157]`. So after `the marketplace "tools" is added to the <scope> scope`, the record stays in `state.json` and the named flip finds it. Verified: the MLOCK-01 and stale flip probes passed, and a named flip with no record fails as not added.
- **Cell values in the layer config `Given`** `[VERIFIED: features/lib/layer-config.ts:34-47]`: the columns are `const MARKETPLACE_COLUMNS: readonly string[] = ["name", "source", "autoupdate"];`, all three required. `true` and `false` set the field, and an empty cell leaves it out (`case "": return undefined;`). The source cell may hold run tokens (`{home}`).
- **An absent `autoupdate` in `declares these marketplaces:`** `[VERIFIED: features/lib/field-rows.ts:93-98]`: `const columns = namesLike(stated, new Set(records.flatMap((record) => [...record.keys()])));`. The actual columns are the stated columns that some record has, followed by any column a record has that the table leaves out. When no declaration has `autoupdate`, a table that states `| autoupdate |` with an empty cell fails, because the actual header is `name, source` (probe 2 printed exactly that diff). So state an absent field by leaving the column out: `| name | source |`. A boolean prints as its JSON text: `true` or `false`.
- **The bytes steps** `[VERIFIED: features/step_definitions/config.steps.ts:55-61]` read `claude-plugins.json` and `pi-claude-marketplace/state.json` of the scope. Both must exist when the remember step runs, which holds after `is added to the <scope> scope`.
- **`the result lists these marketplaces:`** refuses a marketplace that has plugin rows (`marketplace tools has plugin rows; compare them with "the result lists these plugins:"`). A failed flip has a failed child row, so MLOCK-01 must use `the result lists these plugins:`. A stale update has no plugin row, so `the result lists these marketplaces:` works there.
- **No step states "stages no skills".** A header-only table cannot be compared (features.md). The stale remove twin therefore checks `the installation record of the <scope> scope holds no plugins` and the `uninstalled` row, not empty staging.

## Probed Results (current product, 2026-11-08, all passing)

Run: `npx cucumber-js --profile adapter --parallel 3 --order defined --format progress <scratch>/final.feature`. Result: 22 scenarios, 258 steps passed, 19 s wall.

### MLOCK-01 Outline (live holder, the flip fails as lock held)

```gherkin
  Scenario Outline: Changing autoupdate while another process holds the state lock of the scope fails as lock held and changes nothing
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the <scope> scope
    Given a config in scope <scope> and layer base, with these marketplaces:
      | name  | source                    | autoupdate   |
      | tools | {home}/marketplaces/tools | <autoupdate> |
    Given the config and installation record bytes of the <scope> scope are remembered
    Given another process holds the state lock of the <scope> scope
    When the user runs "/claude:plugin marketplace <verb> tools --scope <scope>"
    Then the result has these fields:
      | kind         | cascade                      |
      | severity     | error                        |
      | needs reload | false                        |
      | summary      | Some operations have failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id    | name  | status | reasons   | scope   | cause chain                                                                                                                                                                           | cause truncated | leaks | rollback partial |
      | tools            | <scope>           | failed             | tools | tools | failed | lock held | <scope> | Another pi-claude-marketplace operation is in progress for <scope> scope (<scope root>/pi-claude-marketplace/.state-lock). Retry after it completes., Lock file is already being held | false           |       |                  |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name  | source                    | autoupdate   |
      | tools | {home}/marketplaces/tools | <autoupdate> |
    Then the config and installation record bytes of the <scope> scope are unchanged

    Examples:
      | verb         | scope   | scope root        | autoupdate |
      | autoupdate   | project | {project dir}/.pi | false      |
      | autoupdate   | user    | {agent dir}       | false      |
      | noautoupdate | project | {project dir}/.pi | true       |
      | noautoupdate | user    | {agent dir}       | true       |
```

The probe used `<before>`. The column name is at Claude's discretion. The failed row's `id` and `name` are the marketplace name `tools`, the same shape as the live remove, update, and add rows.

### Stale flip Outline (the twin, the flip completes)

Same Givens, except the lock step is `Given a process that died left the state lock of the <scope> scope`. If D-BG-1507 is followed literally, the remember step stays too (see Dubious Choices). Thens:

```gherkin
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status   |
      | tools | <scope> | <status> |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name  | source                    | autoupdate |
      | tools | {home}/marketplaces/tools | <after>    |

    Examples:
      | verb         | scope   | before | after | status              |
      | autoupdate   | project | false  | true  | autoupdate enabled  |
      | autoupdate   | user    | false  | true  | autoupdate enabled  |
      | noautoupdate | project | true   | false | autoupdate disabled |
      | noautoupdate | user    | true   | false | autoupdate disabled |
```

### Stale add Outline (the twin of the live add Outline)

```gherkin
    Given the marketplace "tools" is published as a <source kind> source
    Given a process that died left the state lock of the <scope> scope
    When the user runs "/claude:plugin marketplace add <source> --scope <scope>"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status |
      | tools | <scope> | added  |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |
```

Use the same three Examples blocks as the live add Outline: untagged dir and file, `@url`, and `@github`. Each block holds both scopes. The `scope root` column is not needed here.

What the scope holds after a stale add, by kind (probed):

| kind | `sources/` checkout | git clones (`clone`, `origin`, `revision`) |
|---|---|---|
| dir, file | none (`holds no marketplace checkout` passes) | none (`holds no git clones` passes) |
| url | `tools` | `marketplace`, `https://{git host}/acme/tools.git`, empty |
| github | `tools` | `marketplace`, `https://github.com/acme/tools.git`, empty (the raw origin, not a token) |

So no single step checks a positive record or checkout for all four kinds. The recommended Thens above match the no-lock add in `add.feature:7-34`.

### Stale remove twins (project = the rewritten seed, and user)

Givens: the same as the live remove scenario in the same scope, with the lock step swapped.

```gherkin
    When the user runs "/claude:plugin marketplace remove fixtures --scope <scope>"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | true    |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | marketplace status | id            | name | status      | reasons | scope   |
      | fixtures         | <scope>           | removed            | demo@fixtures | demo | uninstalled |         | <scope> |
    Then the "claude-plugins.json" file of the <scope> scope declares no marketplaces
    Then the "claude-plugins.json" file of the <scope> scope declares no plugins
    Then the installation record of the <scope> scope holds no plugins
    Then the <scope> scope holds no marketplace record
```

Write these as two plain Scenarios with literal `project` and `user`, like the live ones. A 2-row Outline breaks the rule of three or more variants. Note that `needs reload` is `true` here. The old seed had `false` because it installed no plugin.

### Stale update twins (project and user)

Givens: the same as the live update scenario, with the lock step swapped.

```gherkin
    When the user runs "/claude:plugin marketplace update fixtures --scope <scope>"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name     | scope   | status  | reasons    |
      | fixtures | <scope> | skipped | up-to-date |
    Then the "claude-plugins.json" file of the <scope> scope declares these marketplaces:
      | name     | source                       |
      | fixtures | {home}/marketplaces/fixtures |
    Then the "claude-plugins.json" file of the <scope> scope declares these plugins:
      | id            |
      | demo@fixtures |
    Then the installation record of the <scope> scope holds these plugins:
      | id            | version | enabled |
      | demo@fixtures | 1.0.0   | true    |
    Then the <scope> scope stages these skills and prompts:
      | kind  | name       |
      | skill | demo-skill |
```

`the result lists these plugins:` with `| marketplace name | marketplace scope | marketplace status | marketplace reasons |` also passes (probed on the user scope). The marketplaces form is shorter. Neither form has `id`, `name`, or `status` plugin columns: those make the step fail, because no plugin row exists.

## `npm run check:features` Rules These Scenarios Must Satisfy

Read from `scripts/check-features.mjs` this session.

- **Checked by the script** (fails `check:static`):
  - Every step resolves to exactly one definition, and every definition is used, across all rows (dry run with the tag exclusion cleared, D-09). The seed's `a process that died left the state lock of the {word} scope` stays used by every stale twin.
  - Only `Given`, `When`, and `Then`, never `And` or `But` (`step.keywordType === "Conjunction"`).
  - Step text is lower case outside quoted values (`/[A-Z]/.test(unquoted)`), so `D-06` cannot appear in a step. Titles and the description may hold it. No `should` in a step.
  - No `Given` after a `When` or `Then`.
  - Scenario titles start with an upper-case letter.
  - The only tags on a Scenario or Feature are the MCP implementation tags. `@url` and `@github` go only on `Examples:` blocks.
  - An untagged `Examples:` block that has a `source kind` column holds only `dir` and `file`. An `@url` block holds only `url`, an `@github` block only `github`, and a tagged block must have a `source kind` column.
  - The feature title stays `Marketplace state lock` (kebab of `marketplace/state-lock`), and the description must not be empty.
  - MCP tags: none of these scenarios has the word `mcp` in a step or names `mcpServers` or `.mcp.json`, so none needs a tag. Adding one would be a finding for a two-tag or wrong-tag case.
- **Rules only, not checked by the script, but reviewed** (features.md):
  - An Outline has three or more variants, counting the rows of every Examples block.
  - Tables are aligned.
  - A table lists every row.
  - `<placeholder>` names say what the value is.
  - The description is two or three lines. When extended to name D-06, it should still say what the feature protects and what stands in.

Baseline: `npm run check:features` exits 0 on the current tree (18 s).

## Red-Proof Mechanics (D-BG-1512), Verified in a Scratch Copy

Run each proof in the phase worktree on the uncommitted feature file. Revert the product file before committing.

### A. MLOCK-01: the flip without the scope lock

Temporary diff to `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`. The `persistence/state-io.ts` import already exists as type-only, so add a value import:

```diff
+import { loadState } from "../../persistence/state-io.ts";
 import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
@@ async function flipOneScope(opts: AutoupdateOptions, scope: Scope): Promise<FlipPlan> {
   const locations = locationsFor(scope, opts.cwd);
-  return await withLockedStateTransaction(locations, async (tx) => {
+  void withLockedStateTransaction;
+  const tx = { state: await loadState(locations.extensionRoot) };
+  return await (async () => {
     const plan =
@@
     return plan;
-  });
+  })();
 }
```

Node strips the types, so no build is needed. Command:
`npx cucumber-js --profile adapter --parallel 3 --order defined --format progress features/marketplace/state-lock.feature`

Observed in the scratch copy:

- The 4 MLOCK-01 rows fail at `Then the result has these fields:` (`+ 'info'`, `- 'error'`, and the `summary` row missing).
- The 4 stale flip rows still pass.
- Expect the other scenarios to pass, because they do not run the flip.

Revert: `git checkout -- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`.

### B. MLOCK-02: a longer stale window

Temporary diff to `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:216`:

```diff
-      stale: 10_000,
+      stale: 3_600_000,
```

Same command. Observed:

- All 18 stale twins fail at `Then the result has these fields:` (`+ 'error'`, `- 'info'`, plus the `summary` `Some operations have failed.` row), which is the lock held result.
- The 4 MLOCK-01 live rows still pass.

The rewritten seed is one of the 18. The existing live remove, update, and add scenarios do not depend on the stale window, so they keep passing. proper-lockfile's own check (`update` at most `stale / 2`) is still satisfied with `update: 2_000`.

Revert: `git checkout -- extensions/pi-claude-marketplace/transaction/with-state-guard.ts`. Then run `git status --short` and confirm that only the feature file is changed.

**Pitfall for the proof:** each stale scenario must fail at its `When` result step, not at a `Given`. The lock step must be the last `Given`, after every setup command (`is added to`, `install`), as it is in the live twins. If the lock step came earlier, a setup command would take over the stale lock and remove it. The scenario would then pass with no lock, and under mutation B it would fail in the setup step instead. The SUMMARY should list the failing step of each scenario.

## Common Pitfalls

1. **The order of the lock step.** It must be the last `Given` (see above). With the live holder, an earlier lock step makes the setup command fail as lock held.
2. **The marketplaces step on a failed flip.** `the result lists these marketplaces:` throws "has plugin rows". Use `the result lists these plugins:` for every failed (lock held) result.
3. **An `autoupdate` column for an absent field.** It fails. After `marketplace add`, the config has no `autoupdate` key: use `| name | source |`.
4. **Plugin columns for a stale update.** The update result has no plugin row. Use the marketplaces step with `reasons`, or the plugins step with only the `marketplace ...` columns.
5. **`needs reload` on a stale remove.** It is `true` when `demo` is installed. The old seed's `false` was for an empty marketplace.
6. **The github clone origin is not tokenized.** It is `https://github.com/acme/tools.git`. This matters only if a planner adds a clones check for git kinds, which this research does not recommend.
7. **Two-row Outlines.** The remove and update twins must stay plain Scenarios.
8. **The seed title.** `.agents/skills/cucumber/rules/layout.md` (frozen) lists the seed by its title. No test reads that list (grep found it only in `layout.md`, the Phase 1 plan and SUMMARY, and CONTEXT). If the rewrite changes the title, list a `layout.md` parent line.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| A live lock holder | a new step or helper | `another process holds the state lock of the {word} scope` |
| A dead holder's lock | an mtime fixture | `a process that died left the state lock of the {word} scope` |
| "Nothing changed" | per-field negative checks | the remembered and unchanged bytes steps (config plus state.json) |
| The flip's starting value | a hand-written JSON text config | `a config in scope {word} and layer base, with these marketplaces:` |

## Runtime State Inventory

Not a rename or migration phase, so this section does not apply.

## Environment Availability

| Dependency | Required By | Available | Version |
|------------|------------|-----------|---------|
| Node | cucumber, Pi | yes | v26.13.0 (local); CI 24 |
| Cucumber peers cache | `test:cucumber:profile` | yes (`node_modules/.cache/optional-peers`) | n/a |
| Loopback https git host | url and github rows | in-harness stand-in | n/a |
| `/tmp` inodes | jiti cache and sandboxes | 4% used (`df -i /tmp`: 35856 of 1048576) | n/a |

## Timing

- Today: `features/marketplace/state-lock.feature` has 13 scenarios and 160 steps. At `--parallel 3` it took 16 s wall, and cucumber reported 9.9 s. The brief estimated about 24 s.
- After the phase: 32 scenarios (13 existing, with the seed rewritten in place, plus 19 new: 4 MLOCK-01, 4 stale flip, 8 stale add, 1 stale remove for the user scope, and 2 stale update). The 22-scenario probe took 19 s wall, so expect about 25 to 35 s wall at `--parallel 3`.
- In the CI adapter lifecycle leg (1186 scenarios, 1 min 50 s locally), the 19 new scenarios add about 2 to 4 s. The builtin profile does not run them.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (the `adapter` profile in `cucumber.json`) plus the `check:features` dry-run gate |
| Config file | `cucumber.json` (frozen) |
| Quick run command | `npx cucumber-js --profile adapter --parallel 3 --order defined --format progress features/marketplace/state-lock.feature` (about 30 s) |
| Feature gate | `npm run check:features` (about 18 s) |
| Full suite command | `npm run check` (one background call that writes its exit code to a file), or its parts in order (below) |

### Phase Requirements to Tests Map

| Req ID | Behavior | Test Type | Automated Command | Failing Direction (red proof) | File Exists? |
|--------|----------|-----------|-------------------|-------------------------------|-------------|
| MLOCK-01 | A named `autoupdate` or `noautoupdate` with `--scope` under a live lock: `lock held`, config and state bytes unchanged, base value kept | cucumber Outline (4 rows) | quick run command above | Mutation A: all 4 fail at `the result has these fields:` with info instead of error | the feature exists; the Outline is new |
| MLOCK-02 | A stale lock blocks none of add, remove, update, autoupdate, or noautoupdate, and the result equals the no-lock result | cucumber (18 stale twins) | quick run command above | Mutation B: all 18 fail at `the result has these fields:` as lock held | the seed exists; the rest is new |
| MLOCK-02 (SC 3) | A live lock still blocks the same verbs | the existing live remove, update, and add scenarios plus the MLOCK-01 Outline | quick run command above | Under mutation B the live scenarios still pass, so staleness is the only variable | yes |
| all | The feature-file rules | static | `npm run check:features` | fails on `And`, upper case, misplaced tags, an unused or undefined step | yes |

### Sampling Rate

- **Per task commit:** the quick run command plus `npm run check:features`. The commit hook runs `npm run check:commit`, because `features/**` is a build input.
- **Wave and phase gate (the parts of `npm run check`, in order; never piped):**
  1. `npm run check:static`
  2. `npm run test:unpaired`
  3. `npm run test:integration`
  4. `npm run test:cucumber:profile -- --profile adapter --parallel 3` (or the CI legs: `... --profile adapter features/marketplace features/plugin` and `... --profile adapter features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow`)
  5. `npm run test:cucumber:profile -- --profile builtin --parallel 3`
  6. `npm run test:coverage:direct:all`
- **Phase gate:** also run `npm run test:modules`.
- Rerun a failing cucumber or integration case once before calling a gate red, and record both runs.

### Wave 0 Gaps

None. The test infrastructure, the steps, and the lock stand-ins all exist.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled. The phase adds test scenarios only and no product surface.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | no (no new input) | n/a |
| V6 Cryptography | no | n/a |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Lost update between two Pi processes | Tampering | D-06 per-scope proper-lockfile lock, `retries: 0` (pinned by MLOCK-01) |
| A dead process's lock blocks every verb forever | Denial of service | proper-lockfile's 10 s stale takeover (pinned by MLOCK-02) |
| A test writes to the real `~/.pi` | Tampering | the harness sandbox home; verified unchanged after every probe |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The full 32-scenario feature runs in about 25 to 35 s at `--parallel 3` | Timing | Low: only the timing estimate. |
| A2 | The other scenarios pass under mutation A, because they do not run the flip. I ran mutation A only against the flip probe file, not the whole feature. | Red proofs | Low: the SUMMARY records the real list. |

## Open Questions

1. **The "record" check of the stale add Outline (D-BG-1507 says "config and record").**
   - What we know: no step checks a marketplace record in `state.json` positively. The positive checkout and clone checks differ by kind and are absent for dir and file.
   - Recommendation: pin the result row and the config declaration, as `add.feature` does for the no-lock add. Do not create a verb step module for this. Log it as a dubious choice.
2. **Whether the stale flip twin repeats the remember-bytes `Given`.**
   - Recommendation: keep it, so the twin's Givens match exactly (D-BG-1507). It is harmless, but it has no matching `Then`. Log it as a dubious choice.

## Sources

### Primary (HIGH confidence)

These were read or run this session:

- `features/marketplace/state-lock.feature`
- `features/step_definitions/{config,scope-state,command}.steps.ts`
- `features/step_definitions/marketplace/{checkout,publishing}.steps.ts`
- `features/step_definitions/plugin/installation.steps.ts`
- `features/lib/{layer-config,field-rows,state-lock-holder}.ts`
- `scripts/check-features.mjs`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`
- `node_modules/proper-lockfile/lib/lockfile.js`
- three probe runs and two mutation runs (scratchpad `p15/research/*.feature` and `*.out`)

### Secondary

- 15-CONTEXT.md (the upstream binary research from the discuss step, not repeated here)

## Metadata

**Confidence breakdown:**

- Steps and rows: HIGH. They were probed and pass.
- Red proofs: HIGH. Both were run in a scratch copy.
- Timing: MEDIUM. It is an estimate from the probe run.

**Research date:** 2026-11-08
**Valid until:** the next merge of `features/behavioral-gaps` that touches the marketplace result wording or the frozen step modules.
