# Phase 3: Marketplace Add - Research

**Researched:** 2026-10-16
**Domain:** Cucumber behavioral scenarios for `/claude:plugin marketplace add` (and one `remove --local` scenario), run against the real extension in a headless Pi
**Confidence:** HIGH (every payload below was read off a real Pi run in a hermetic sandbox this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Duplicate name (ADD-04)
- **D-01:** One Outline with two variants: the same source added twice, and a second marketplace published from another directory whose manifest declares the same name. Each variant has a dir row and an `@url` row. The duplicate check compares only the manifest name (`newMarketplaceName`), so only the second variant catches an implementation that compares sources instead.
- **D-02:** The scenario checks the failed row: the manifest name, `failed`, `duplicate name`, and error severity. It also checks that the scope's `claude-plugins.json` still declares the original source, which catches an add that reports the duplicate but still overwrites the record.

#### Failure inputs (ADD-06, ADD-07)
- **D-03:** ADD-06 is one Outline with local rows only, one for each of four spellings:
  - a missing absolute directory, `{home}/marketplaces/missing`;
  - the `~/` form, `~/marketplaces/missing`;
  - a missing manifest file path, `{home}/marketplaces/missing/.claude-plugin/marketplace.json`;
  - an existing directory with no `.claude-plugin/marketplace.json`.

  Each fails as `source missing`, and the row's name equals the source exactly as typed. The `~/` row is the one that tells "as typed" apart from "as resolved". The directory with no manifest fails on a different branch: reading the manifest fails, not the `stat`. The url 404 row is ADD-09 (Phase 9).
- **D-04:** ADD-07 is one Outline with a `<manifest problem>` column, malformed JSON or schema-invalid. That column is crossed with dir and file (four untagged rows) and with url (two `@url` rows). Each row fails as `invalid manifest`, named by the source as typed. Malformed JSON needs a new fixture mode beside `writeInvalidManifest`, chosen by source kind in `features/lib/published-marketplace.ts`. The url branch throws `noStandIn` until Phase 9.
- **D-05:** The ADD-06 and ADD-07 scenarios compare the whole failed result (its fields and the failed row) and check nothing more. These failures throw before anything is written, inside the locked transaction. A plausible wrong implementation names the wrong reason or the wrong subject, and the row check catches both.

#### `--local` round trip (ADD-13)
- **D-06:** The `add --local` scenario first adds another marketplace without `--local`, so the base file exists. After `add --local`, the base `claude-plugins.json` declares only that first marketplace, and `claude-plugins.local.json` declares only the new one. Both checks use the existing read-only config step. This setup is also how real users meet `--local`, and it avoids the first-run migration path (D-08).
- **D-07:** The `remove --local` scenario lives in a new `features/marketplace/remove.feature` (`Feature: Marketplace remove`). Phase 3 creates it and Phase 4 extends it. This works because this run executes phases one at a time. A step that only `remove` uses goes in `features/step_definitions/marketplace/remove.steps.ts`. No reload or new session separates the add from the remove.
- **D-08:** A defect found while reading the code during discussion, not yet confirmed on a real Pi.
  - **The leak.** `migrateFirstRunConfig` (`persistence/migrate-config.ts:181`, MIG-01) checks only the base file. In a scope whose first add was `--local`, `state.json` exists but `claude-plugins.json` does not. On the next load (`orchestrators/reconcile/apply.ts::readPassForScope`), `buildConfigFromState` therefore writes the base file from the records, and the `--local` marketplace goes with them. That puts a per-machine entry in the shared, possibly committed, base file.
  - **The consequence.** After that, `remove --local` clears the local entry and the record, but the base file still declares the marketplace, so the next reload adds it back.
  - **The decision.** The user chose to fix it test-first in an inserted Phase 3.1, under a new requirement FIX-02, as Phase 6 does for C-10. Phase 3's own scenarios never reload between `add --local` and their checks, so they pass on today's code.

#### Both scopes (ADD-05)
- **D-09:** One Outline over every kind: dir, file, `@url`, and `@github`. Given the marketplace is added to the user scope, adding it with `--scope project` succeeds (`added`, `project`), and each scope's `claude-plugins.json` declares it. Each git kind makes a second clone into the other scope's root, the step most likely to break if a clone key or the leftover-clone check is shared between scopes. Listing both rows (LS-02) and removing one of them (RM-08) stay in Phase 4.

### Claude's Discretion
- ADD-02 is a single dir scenario: an absolute path with no `--scope`, a row reading `user`, and the user scope's `claude-plugins.json` declaring it. The research found one kind enough (MF-ADD-02).
- The exact step wording (layout.md: step text belongs to the writer). That includes the step that publishes a marketplace in a directory whose manifest declares another name, the fixture for a directory with no manifest, and the content of the malformed JSON.
- How the `remove --local` scenario shows the local entry is gone. Option 1 is a second local entry that stays. Option 2 is a new read step for a file that exists with an empty `marketplaces` map; `remove` keeps the file and writes `marketplaces: {}`, and `config.steps.ts` asks a zero-declaration step to say which of the two cases it means. Whichever is chosen, the base file is seeded as in D-06 and stays untouched.
- Which scope the `--local` scenarios use. The project scope, whose base file a team commits, is where a per-machine layer matters most.
- Any tightening of the ADD-01, ADD-03, and ADD-14 seeds that a cucumber-skill review asks for.

### Deferred Ideas (OUT OF SCOPE)
- **Phase 3.1 (inserted after Phase 3): the `--local` leak (D-08), under FIX-02.** The requirement, stated as behavior and not as a mechanism: after `add --local` and a reload, `claude-plugins.json` does not declare the marketplace; after `remove --local` and a reload, the marketplace stays removed. The scenario is written first and must fail on today's code. The fix phase's own discussion settles the mechanism and any parity question about Claude Code's local settings layer (SC-1 declines the `local` scope).
- Phase 4 should check what `remove` without `--local` does to a marketplace declared only in `claude-plugins.local.json`. This was not verified here.
- Listing both scopes (LS-02) and removing one of two scopes' entries (RM-08) stay in Phase 4.

#### Reviewed Todos (not folded)
- `2026-10-13-cucumber-rules-trial` (§3, porting the cucumber skill and gates to `acolomba/blueprint-typescript`): it matched only on keywords, and it concerns another repository.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADD-01 | Adding a marketplace records it in the chosen scope under its manifest name (dir, file, url, gh) | Already seeded and green (`features/marketplace/add.feature:7-34`). Success payload verified below (§Wire Payloads, P1). No change needed. |
| ADD-02 | Without `--scope`, add uses the user scope | New single dir scenario. Probe: row `scope: "user"`, user `claude-plugins.json` declares it, project file absent (§Wire Payloads, P2). |
| ADD-03 | An added marketplace appears in `marketplace list` and is still there in a new session (dir, url) | Already seeded and green (`add.feature:50-80`). No change needed. |
| ADD-04 | Adding a name the scope already holds fails as `duplicate name` (dir, url) | Both D-01 variants probed: identical failed row `name: "tools"` (the manifest name, not the typed source) and the base file still declares the original source (§Wire Payloads, P4). Needs one new add-only publish step and a lib publish-in-directory mode. |
| ADD-05 | The same marketplace can be added to both scopes independently | dir and file probed: second add into project is `added`, both files declare the source (§Wire Payloads, P3). Existing steps suffice. |
| ADD-06 | A path that does not exist fails as `source missing`, named by the source as typed | All four D-03 spellings probed; each row name is the typed text, `~/marketplaces/missing` stays `~` (§Wire Payloads, P5). Needs one add-only "directory with no manifest" fixture step. |
| ADD-07 | A malformed or schema-invalid manifest fails as `invalid manifest` (dir, url) | Malformed JSON and schema-invalid, dir and file, probed: all `invalid manifest`, name = typed source (§Wire Payloads, P6). Needs a malformed-JSON lib mode and add-only step(s). |
| ADD-13 | `add --local` writes the declaration to `claude-plugins.local.json`, and `remove --local` clears it | D-06 add probed (base declares only the first, local only the new). `remove --local` probed: `removed` row, local file keeps `{"marketplaces": {}, "plugins": {}}` or the remaining entry (§Wire Payloads, P7/P8). Existing steps suffice with Option 1. |
| ADD-14 | `add ~/...` keeps the `~` form and resolves it against HOME | Already seeded and green (`add.feature:36-48`). No change needed. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; this work is on `features/cucumber-behavioral-tests`. Never rebase or rewrite history; never `--no-verify`; never `git add -A` (the user edits concurrently). [CITED: AGENTS.md "Git"]
- Commit messages follow `.agents/skills/committing/SKILL.md`: Conventional Commits, title 5-72 chars, body lines ≤80, **no GSD milestone/phase/plan/wave in the message or scope** (write `test(marketplace): ...`, not `test(03-01): ...`). [CITED: .agents/skills/committing/SKILL.md]
- Every plan `SUMMARY.md` includes `## Threat Flags` (even "None"). [CITED: AGENTS.md "GSD records"]
- `features/**` is a build input: every commit that stages a file under `features/` runs `npm run check:commit` (= `check:static` incl. `check:features`, `test:unpaired`, direct coverage of staged pairs). It does **not** run `test:cucumber`. GSD gates run `npm run check` on the combined tree. [VERIFIED: .pre-commit-config.yaml:107-112; package.json:86-89]
- Before committing: `SKIP=npm-check pre-commit run --files <changed files>`, then `git commit` in the foreground. [CITED: .agents/skills/committing/SKILL.md]
- Subagent probes must use a hermetic home; never touch the real `~/.pi/agent`. [CITED: project memory "Subagent tests must use hermetic home"]
- Never run `gsd-tools query config-set` (reformats `.planning/config.json`, breaks `format:check`). [CITED: orchestrator instructions]
- Upstream parity: none applies (test-suite phase; the code is pinned, C-1..C-13). [CITED: 03-CONTEXT.md domain]
- Comments cite durable IDs (D-NN, ADD-NN), never GSD phase/plan/wave references. [CITED: .planning/codebase/CONVENTIONS.md "Comments"]

## Summary

Phase 3 is test-suite work only: new scenarios in `features/marketplace/add.feature`, a new `features/marketplace/remove.feature` with one scenario, one new verb step module `features/step_definitions/marketplace/add.steps.ts`, and two small fixture modes in `features/lib/`. No production code changes. Three of the nine requirements (ADD-01, ADD-03, ADD-14) are already seeded and green; the planner only needs to keep them passing.

Every payload the new scenarios will compare was read off a real headless Pi through the existing harness (`features/lib/pi-process.ts`, `features/lib/pi-commands.ts`) in a `mkdtemp` sandbox. Two facts in CONTEXT.md need correcting before the planner copies them into tables: (1) **the failed marketplace row on the wire has no `severity` field** (the `MARKETPLACE_BLOCK` schema has no such property), so "error severity" (D-02) is stated through the envelope row `| severity | error |`, and the row table is `name | scope | status | reasons`; (2) **the manifest cache survives `new_session`** in this harness, contradicting `.planning/research/PITFALLS.md` Pitfall 12 ("`new_session` builds a fresh cache"), so a negative cache entry from one scenario lives on for later scenarios in the same worker. The protection is unchanged: every manifest content written at a given path must differ in size from every other content written there.

The D-08 `--local` leak is now **confirmed on a real Pi** (informational for Phase 3.1): a first `add --local` in a scope, followed by a new session, writes the local-only marketplace into `claude-plugins.json`. With D-06's seeded base entry, the base file stays clean across a new session, so Phase 3's scenarios pass on today's code.

**Primary recommendation:** Write six new scenario blocks (ADD-02, ADD-04, ADD-05, ADD-06, ADD-07, ADD-13 add) in `add.feature` and one `remove --local` scenario (Option 1: a second local entry stays) in `remove.feature`. Put the three add-only fixture steps in `add.steps.ts`, each with "add" in its text, backed by kind-dispatched lib functions. Land each new step in the same commit as its first scenario, because the commit hook's `check:features` fails on an unused or undefined step.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scenario text (behavior + whole-value tables) | `features/marketplace/*.feature` | — | features.md: a reader understands the scenario without opening a step definition. |
| Add-only fixture steps (second same-name marketplace, directory with no manifest, malformed manifest) | `features/step_definitions/marketplace/add.steps.ts` (new verb module) | — | 03-CONTEXT: steps only `add` uses go there; layout.md: verb-module text names its verb (D-08). |
| Shared publish/add/config/result steps | `marketplace/publishing.steps.ts`, `config.steps.ts`, `command.steps.ts` (existing, unchanged) | — | Already cover ADD-02, ADD-05, ADD-13; no promotion needed. |
| Kind dispatch of fixtures (dir/file write; url/github throw `noStandIn`) | `features/lib/published-marketplace.ts` | `features/lib/path-marketplace.ts` (dir/file bytes) | world-and-stand-ins.md: "library code dispatches on [the recorded kind]. A new source kind changes library code only." |
| Running Pi, validating payloads, token projection | `features/lib/pi-commands.ts`, `run-tokens.ts`, `field-rows.ts` (existing) | `features/support/pi-process.ts` | Unchanged. |
| Behavior under test | `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,remove}.ts` | `domain/manifest.ts`, `domain/manifest-cache.ts`, `persistence/config-write-back.ts` | Read-only for this phase. |

## Standard Stack

### Core (all already installed; no new dependency)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cucumber/cucumber` | 13.3.0 | Runner, `Given/When/Then`, data tables, Outlines | Project's behavioral test runner [VERIFIED: `node -p require('@cucumber/cucumber/package.json').version` → 13.3.0] |
| `node:assert/strict` | Node built-in | Whole-value `deepStrictEqual` | steps.md mandates it [CITED: .agents/skills/cucumber/rules/steps.md] |
| `typebox` (existing) | per lock | `NOTIFICATION_PAYLOAD_SCHEMA` validation in the driver | Already used by `features/lib/pi-commands.ts:14-36` [VERIFIED: read this session] |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external package.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Wire Payloads (Q1) — read off a real Pi this session

Probe method: a throwaway script in the session scratchpad imported `features/lib/pi-process.ts`, `pi-commands.ts` (`runCommandPayloads`, which validates every payload against `NOTIFICATION_PAYLOAD_SCHEMA`), and `path-marketplace.ts`, started one Pi in a `realpath(mkdtemp(tmpdir()))` sandbox, emptied the sandbox and ran `new_session` between cases exactly as `features/support/pi-process.ts:252-275` does, and printed each payload with `origin` dropped and the sandbox HOME projected to `{home}`. The sandbox and scripts were deleted afterwards. [VERIFIED: real Pi run, output pasted below]

The step `the result has these fields:` compares **every** envelope field except `schemaVersion`, `origin`, `marketplaces`, `blocks` [VERIFIED: features/step_definitions/command.steps.ts:33-39 — `const ROW_FIELDS ... = new Set(["marketplaces", "blocks"]);` and `const UNSTATED_FIELDS ... = new Set(["schemaVersion", "origin", ...ROW_FIELDS]);`]. The step `the result lists these marketplaces:` compares every field of every block except `plugins` (and fails if `plugins` is non-empty) [VERIFIED: command.steps.ts:79-87]. A field missing from a table fails, because `recordTable`/`namesLike` append any column the table leaves out [VERIFIED: features/lib/field-rows.ts:78-96].

### P1. Success (`add <source> --scope project`, also ADD-05's second add)

```
[{"schemaVersion":1,"kind":"cascade","severity":"info","needsReload":false,"marketplaces":[{"name":"tools","scope":"project","status":"added","plugins":[]}]}]
```

| Envelope table (`the result has these fields:`) | Row table (`the result lists these marketplaces:`) |
|---|---|
| `kind` cascade / `severity` info / `needs reload` false — **no `summary`, no `tally`** | `name \| scope \| status` → `tools \| project \| added` |

Same shape for dir and file sources, and for `--local` (P7).

### P2. ADD-02, no `--scope`

```
> /claude:plugin marketplace add {home}/marketplaces/tools
[{"schemaVersion":1,"kind":"cascade","severity":"info","needsReload":false,"marketplaces":[{"name":"tools","scope":"user","status":"added","plugins":[]}]}]
  user/claude-plugins.json: { "schemaVersion": 1, "marketplaces": { "tools": { "source": "{home}/marketplaces/tools" } } }
  project/claude-plugins.json: ENOENT
```
Row: `tools | user | added`. Config step: `the "claude-plugins.json" file of the user scope declares these marketplaces:` → `tools | {home}/marketplaces/tools`. The config entry holds only `source` (no `autoupdate` key), so the table is `name | source`.

### P3. ADD-05, user then project (dir and file)

```
> add {home}/marketplaces/tools --scope user      → ...{"name":"tools","scope":"user","status":"added","plugins":[]}
> add {home}/marketplaces/tools --scope project   → ...{"name":"tools","scope":"project","status":"added","plugins":[]}
  user/claude-plugins.json:    { "marketplaces": { "tools": { "source": "{home}/marketplaces/tools" } } }
  project/claude-plugins.json: { "marketplaces": { "tools": { "source": "{home}/marketplaces/tools" } } }
(file kind: identical, with source "{home}/marketplaces/tools/.claude-plugin/marketplace.json")
```
The When payload is P1 with `scope: "project"`. Two config `Then`s, one per scope, each `tools | <source>`.

### P4. ADD-04 duplicate name, both D-01 variants

```
> add {home}/marketplaces/tools --scope project        (second time, variant 1)
[{"schemaVersion":1,"kind":"cascade","severity":"error","needsReload":false,"summary":"A marketplace operation has failed.","marketplaces":[{"name":"tools","scope":"project","status":"failed","reasons":["duplicate name"],"plugins":[]}]}]
> add {home}/marketplaces/tools-copy --scope project   (variant 2: tools-copy's manifest declares "tools")
[{"schemaVersion":1,"kind":"cascade","severity":"error","needsReload":false,"summary":"A marketplace operation has failed.","marketplaces":[{"name":"tools","scope":"project","status":"failed","reasons":["duplicate name"],"plugins":[]}]}]
  project/claude-plugins.json: { "marketplaces": { "tools": { "source": "{home}/marketplaces/tools" } } }   (both variants)
```

| Envelope table | Row table |
|---|---|
| `kind` cascade / `severity` error / `needs reload` false / `summary` `A marketplace operation has failed.` | `name \| scope \| status \| reasons` → `tools \| project \| failed \| duplicate name` |

The row name is the **manifest name** `tools`, not the typed source [VERIFIED: add.ts:366-370 `addSubjectName`: `if (err instanceof MarketplaceDuplicateNameError) { return err.mpName; }`]. Config check: `tools | {home}/marketplaces/tools` (the original source) in both variants.

**Correction to CONTEXT (Established Patterns, D-02):** the internal row object is `{ name: subject, scope, status: "failed", reasons: [reason], severity: "error", plugins: [] }` [VERIFIED: add.ts:567-573], but the wire block schema has no `severity` property: `MARKETPLACE_BLOCK = Type.Object({ name: Type.String(), scope: SCOPE, plugins: Type.Array(PLUGIN_ROW), status: Type.Optional(MARKETPLACE_STATUS), details: Type.Optional(MARKETPLACE_DETAILS), reasons: Type.Optional(Type.Array(REASON)) }, { additionalProperties: false })` [VERIFIED: extensions/pi-claude-marketplace/shared/notification-wire.ts:297-307]. A row table with a `severity` column fails. State severity in the envelope table.

### P5. ADD-06 source missing, the four D-03 spellings (`--scope project`)

```
> add {home}/marketplaces/missing --scope project
  ...{"name":"{home}/marketplaces/missing","scope":"project","status":"failed","reasons":["source missing"],"plugins":[]}
> add ~/marketplaces/missing --scope project
  ...{"name":"~/marketplaces/missing","scope":"project","status":"failed","reasons":["source missing"],"plugins":[]}
> add {home}/marketplaces/missing/.claude-plugin/marketplace.json --scope project
  ...{"name":"{home}/marketplaces/missing/.claude-plugin/marketplace.json","scope":"project","status":"failed","reasons":["source missing"],"plugins":[]}
> add {home}/marketplaces/empty --scope project      ({home}/marketplaces/empty exists, no .claude-plugin/)
  ...{"name":"{home}/marketplaces/empty","scope":"project","status":"failed","reasons":["source missing"],"plugins":[]}
  project/claude-plugins.json: ENOENT
```
Every envelope is the P4 envelope (`error`, `false`, summary `A marketplace operation has failed.`). Row: `<source> | project | failed | source missing`, so the Outline's row table can use the `<source>` placeholder in the `name` cell. Block names are redacted for credentials only, not for absolute paths [VERIFIED: shared/notification-resolve.ts:366-369 — `name: redactCredentials(mp.name)`], so `{home}` projects back exactly. The `~` row keeps `~` because the subject is `opts.rawSource` and `~` is expanded only for the disk lookup [VERIFIED: add.ts:1101 `const onDiskPath = expandTildePath(source.logical);`].

Branches: rows 1-3 fail in `stat` (ENOENT); row 4 passes `stat` as a directory and fails in `loadMarketplaceManifest` → `readFile` ENOENT (the cache treats a `stat` failure as a pure miss and lets the error through) [VERIFIED: domain/manifest-cache.ts:82-89; add.ts:311-312 `if (code === "ENOENT" || code === "ENOTDIR") { return "source missing";`].

### P6. ADD-07 invalid manifest (malformed JSON and schema-invalid; dir and file)

```
schema-invalid (writeInvalidManifest: "plugins":"nope"):
> add {home}/marketplaces/tools --scope project
  ...{"name":"{home}/marketplaces/tools","scope":"project","status":"failed","reasons":["invalid manifest"],"plugins":[]}
> add {home}/marketplaces/tools/.claude-plugin/marketplace.json --scope project
  ...{"name":"{home}/marketplaces/tools/.claude-plugin/marketplace.json","scope":"project","status":"failed","reasons":["invalid manifest"],"plugins":[]}
malformed JSON ('{"name": "tools",'):
  identical rows for dir and file (reasons ["invalid manifest"], name = typed source)
  project/claude-plugins.json: ENOENT
```
Envelope = P4 envelope. Row: `<source> | project | failed | invalid manifest`. Both problems become `InvalidMarketplaceManifestError` [VERIFIED: domain/manifest.ts:113-131 — `throw new InvalidMarketplaceManifestError(\`marketplace.json is not valid JSON: ${String(err)}\`, ...)` and `throw new InvalidMarketplaceManifestError(\`marketplace.json schema invalid: ${detail}\`)`] → `return "invalid manifest";` [VERIFIED: add.ts:300-301]. The row carries no cause, so the V8 `SyntaxError` wording never reaches a table (Node-version-safe). Note: `marketplace info` reports malformed JSON as `unparseable`, not `invalid manifest` (Phase 1 research Pattern 3); that difference is Phase 5's concern, not Phase 3's.

### P7. ADD-13 `add --local` after a seeded base entry (D-06)

```
> add {home}/marketplaces/extras --scope project
  ...{"name":"extras","scope":"project","status":"added","plugins":[]}
> add {home}/marketplaces/tools --scope project --local
[{"schemaVersion":1,"kind":"cascade","severity":"info","needsReload":false,"marketplaces":[{"name":"tools","scope":"project","status":"added","plugins":[]}]}]
  project/claude-plugins.json:       { "schemaVersion": 1, "marketplaces": { "extras": { "source": "{home}/marketplaces/extras" } } }
  project/claude-plugins.local.json: { "schemaVersion": 1, "marketplaces": { "tools":  { "source": "{home}/marketplaces/tools"  } } }
```
P1 envelope; row `tools | project | added`. Base declares only `extras`; local declares only `tools`.

### P8. `remove --local` (for `remove.feature`)

```
Option 2 shape (single local entry):
> remove tools --scope project --local
[{"schemaVersion":1,"kind":"cascade","severity":"info","needsReload":false,"marketplaces":[{"name":"tools","scope":"project","status":"removed","plugins":[]}]}]
  project/claude-plugins.json:       { "marketplaces": { "extras": { "source": "{home}/marketplaces/extras" } } }   (untouched)
  project/claude-plugins.local.json: { "schemaVersion": 1, "marketplaces": {}, "plugins": {} }
Option 1 shape (two local entries "tools" and "extras", base "base"):
> remove tools --scope project --local
  ...{"name":"tools","scope":"project","status":"removed","plugins":[]}
  project/claude-plugins.json:       { "marketplaces": { "base": { "source": "{home}/marketplaces/base" } } }   (untouched)
  project/claude-plugins.local.json: { "schemaVersion": 1, "marketplaces": { "extras": { "source": "{home}/marketplaces/extras" } }, "plugins": {} }
```
P1 envelope; row `tools | project | removed`. `remove tools --local` without `--scope` resolves to the project scope (the only holder) and gives the same payload. `remove --local` of a name not added emits a different kind: `{"kind":"marketplace-not-added","severity":"error","needsReload":false,"summary":"A marketplace operation has failed.","name":"tools","scope":"project","reasons":["marketplace not added"]}` (not needed by Phase 3; Phase 4 territory). The config step reads only the `marketplaces` map, so the added `"plugins": {}` key is invisible to it [VERIFIED: features/step_definitions/config.steps.ts:42-56].

## Feature Gate Rules (Q2) — `scripts/check-features.mjs`

What the gate enforces, read from the script [VERIFIED: scripts/check-features.mjs, read in full this session]:

| Rule | Where | Effect on Phase 3 shapes |
|---|---|---|
| Dry run with `tagExpression = ""`: every row of every Outline, `@url`/`@github` included, must match exactly one definition; every definition must be used | :104-119, :135-145, :173-198 | `@url` rows of ADD-04/ADD-07 and `@url`/`@github` rows of ADD-05 must use only defined steps. A new step definition committed without a using scenario fails (unused). |
| A tagged `Examples:` block must have a `source kind` column; an untagged block's `source kind` cells must be `dir` or `file`; a tagged block's cells must equal its tag | :342-386 (`localKinds = new Set(["dir", "file"])`, `sourceTags = new Set(["@url", "@github"])`) | ADD-06 (untagged, **no** `source kind` column) → no finding: `if (rows === undefined) { return tags.length === 0 ? [] : [...] }`. ADD-07 (`manifest problem`, `source kind`, `source`): untagged dir/file + `@url` url rows → no finding. |
| Tags only `@url`/`@github`, only on `Examples:` blocks | :328-340 | Never tag a scenario or the feature. |
| Feature title = kebab of `<function>-<capability>` file name; non-empty description | :312-326, :478-488 | `features/marketplace/remove.feature` must be `Feature: Marketplace remove` with a 2-3 line description. |
| Scenario titles start upper case | :430-444 | — |
| Step keyword not `And`/`But`; text lower case outside `"..."`/`'...'`; no "should" | :388-405 | Checked on the **template** text (`<manifest problem>` placeholders), not on substituted row values. Keep row values that land in unquoted step text lower case anyway (features.md rule). |
| No `Given` after a `When`/`Then` | :407-421 | Every setup (`--local` adds, second publish, empty dir) precedes the `When`. |
| Step definitions are Cucumber expressions | :149-157 | No regex. |
| Layout: `step_definitions/**` files end `.steps.ts`, depth ≤3; `lib/`,`support/` `.ts` not `.steps.ts`; no catch-all names; no module beside a same-named directory; function dirs hold `.feature` only | :225-302 | `step_definitions/marketplace/add.steps.ts` (depth 3) and `remove.steps.ts` are allowed. |

**Not enforced by the gate (review-only rules):**
- The three-or-more-variants rule for an Outline (features.md: "A `Scenario Outline` is for three or more variants... The three variants of an Outline count the rows of every `Examples:` block, tagged or not"). Planned counts: ADD-04 = 4 (2 dir + 2 `@url`), ADD-05 = 4, ADD-06 = 4, ADD-07 = 6 (4 local + 2 `@url`). All pass.
- "Verb-module step text names its verb" (layout.md, D-08). Reviewer-only; the gate cannot see it.
- Lint (ESLint block for `features/step_definitions/**/*.steps.ts`): a step module exports nothing; step text is a string literal; `Given/When/Then` imported by name; no hooks/parameter types in step modules [VERIFIED: eslint.config.js:258-326].

None of the planned shapes trips a gate rule.

## Fixtures and Steps (Q3)

### Existing steps that already cover part of the phase (no change)

| Step text | Module | Used for |
|---|---|---|
| `the marketplace {string} is published as a {source kind} source` | `marketplace/publishing.steps.ts:92-103` | every scenario |
| `the marketplace {string} is added to the {word} scope` | `publishing.steps.ts:117-127` | ADD-04 first add, ADD-05 user-scope add, ADD-13 base entry |
| `the manifest of the marketplace {string} has become invalid` | `publishing.steps.ts:129-134` | (callable from ADD-07's schema-invalid path via its lib function) |
| `the user has run {string}` | `command.steps.ts:101-104` | `--local` setup adds in `remove.feature` |
| `the user runs {string}` / `the result has these fields:` / `the result lists these marketplaces:` | `command.steps.ts` | every When/Then |
| `the {string} file of the {word} scope declares these marketplaces:` | `config.steps.ts:31-60` | ADD-02/04/05/13, remove |

### New add-only steps → `features/step_definitions/marketplace/add.steps.ts` (new verb module)

CONTEXT locks "steps that only `add` uses go in `add.steps.ts`", and layout.md requires verb-module text to name its verb. Each of the three steps below is add-only, so each text contains "add". Wording is the writer's; these are compliant examples (Cucumber expressions, lower case, no collision with an existing pattern):

| Need | Example step text (definition) | Lib call |
|---|---|---|
| ADD-04 v2: another directory whose manifest declares the same name | `another marketplace named {string} to add is published as a {source kind} source in {string}` (e.g. `Given another marketplace named "tools" to add is published as a <source kind> source in "tools-copy"`) | new kind-dispatched function in `published-marketplace.ts` that writes the manifest name into a directory of another name (dir/file → `writeMarketplace(path.join(marketplacesRoot, directory), name, [])`; url/github → `noStandIn`) |
| ADD-06 row 4: an existing directory with no manifest | `the directory {string} to add holds no marketplace manifest` (e.g. `Given the directory "empty" to add holds no marketplace manifest` → creates `{home}/marketplaces/empty/`) | `mkdir(path.join(marketplacesRoot, name), { recursive: true })`; inline in the step or a tiny `path-marketplace.ts` helper |
| ADD-07 malformed JSON and schema-invalid | two literal definitions selected by the `<manifest problem>` column: `the manifest of the marketplace {string} to add is not valid json` and `the manifest of the marketplace {string} to add breaks the manifest schema` (Outline step: `Given the manifest of the marketplace "tools" to add <manifest problem>`, column values `is not valid json` / `breaks the manifest schema`) | malformed: new `writeMalformedManifest` in `path-marketplace.ts` + kind dispatch in `published-marketplace.ts`; schema-invalid: existing `invalidateManifest` |

Why two literal definitions for ADD-07 rather than one `{string}` step: a misspelled `{string}` value in an excluded `@url` row would hide until Phase 9 runs it, while a misspelled literal phrase is an **undefined step** that `check:features` rejects today (the same reasoning `features/support/source-kind.ts:1-9` gives for the `source kind` parameter type). A custom `{manifest problem}` parameter type in a new `features/support/manifest-problem.ts` is the equivalent alternative; it costs a support module.

Rules every new step follows [CITED: .agents/skills/cucumber/rules/steps.md, world-and-stand-ins.md]:
- Anonymous `function (this: ScenarioWorld, ...)` when it touches the world; register the directory's release with `this.onRelease(() => rm(dir, { recursive: true, force: true }))`, as `publishing.steps.ts:99-101` does.
- A setup `Given` asserts its setup succeeded (the lib write throws on failure; that suffices).
- Do **not** call `this.recordPublished("tools", ...)` from the second-publish step: the world map is keyed by marketplace name (`world.ts:119-127`) and would overwrite the first `tools` record. Record nothing, or record under the directory name.
- `@fileoverview` header saying what the module's steps own; module exports nothing; order `Given`, `When`, `Then`.

Alternative for ADD-06 row 4 with no new step: type `{home}/marketplaces/tools/.claude-plugin` after publishing `tools` as dir (an existing directory with no `.claude-plugin/marketplace.json` inside; it fails `source missing` the same way). It is a realistic mistake (adding the manifest's folder instead of the root), but it puts "published as a dir source" into a source-missing Outline, which reads oddly. Recommendation: the explicit empty-directory step.

### New lib modes (`features/lib/`)

- `path-marketplace.ts`: add `writeMalformedManifest(root, name)`. Recommended content: the valid manifest text minus its last character (`{"name":"tools","owner":{"name":"features"},"plugins":[]` → 56 bytes), which is malformed JSON and is guaranteed a different size from the valid manifest (57 bytes) and the schema-invalid one (61 bytes). Build the valid text through one shared helper so `writeMarketplace`, `writeInvalidManifest`, and the malformed writer do not grow a copy of the manifest object (fallow clone detection: min 50 tokens / 5 lines; `fallow audit` in CI fails a PR on any newly introduced clone group).
- `published-marketplace.ts`: one kind-dispatched entry for the malformed mode and one for "publish manifest name X into directory Y", each with `case "url": case "github": throw noStandIn(kind);`. Prefer a parameter on the existing switch (e.g. a manifest-problem argument to the invalidation dispatcher, and a directory argument to the publish dispatcher with the current `publishMarketplace` delegating to it) over a cloned switch.

### `remove --local` (Option 1 recommended; no `remove.steps.ts` needed)

Option 1 (a second local entry stays) uses only existing steps and catches more wrong implementations than Option 2: an implementation that deletes the whole local file, or clears every local entry, fails the local-file table; one that touches the base file fails the base-file table. Option 2 needs a new zero-declaration step in `config.steps.ts`, which its own header says must name which of the two cases it means [VERIFIED: config.steps.ts:7-12]. With Option 1, D-07's `remove.steps.ts` is not created in this phase.

Sketch (wording the writer's):
```gherkin
Feature: Marketplace remove

  Removing a marketplace drops its record from a scope and its declaration from
  the configuration file it was added to. The scenarios run the real extension in
  a headless Pi, read its JSON results, and use local marketplaces in place of published ones.

  Scenario: Removing a marketplace with --local clears only its local declaration
    Given the marketplace "base" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "base" is added to the project scope
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Given the user has run "/claude:plugin marketplace add {home}/marketplaces/extras --scope project --local"
    When the user runs "/claude:plugin marketplace remove tools --scope project --local"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  |
      | tools | project | removed |
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:
      | name   | source                     |
      | extras | {home}/marketplaces/extras |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name | source                   |
      | base | {home}/marketplaces/base |
```
The description must stay true when Phase 4 adds the plugin-cascade and scope scenarios.

## Scenario Skeletons for `add.feature` (wording the writer's)

```gherkin
  Scenario: Adding a marketplace without a scope records it in the user scope
    Given the marketplace "tools" is published as a dir source
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools"
    Then the result has these fields:             # kind cascade / severity info / needs reload false
    Then the result lists these marketplaces:     # tools | user | added
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:   # tools | {home}/marketplaces/tools

  Scenario Outline: Adding a name the scope already holds fails as a duplicate
    Given the marketplace "tools" is published as a <source kind> source
    Given another marketplace named "tools" to add is published as a <source kind> source in "tools-copy"
    Given the marketplace "tools" is added to the project scope
    When the user runs "/claude:plugin marketplace add <second source> --scope project"
    Then the result has these fields:             # cascade / error / false / summary A marketplace operation has failed.
    Then the result lists these marketplaces:     # tools | project | failed | duplicate name
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:   # tools | <source>
    Examples:            | source kind | source | second source |   dir: {home}/marketplaces/tools  ×  {home}/marketplaces/tools  and  {home}/marketplaces/tools-copy
    @url Examples:       | source kind | source | second source |   url: https://{git host}/acme/tools.git  ×  same  and  https://{git host}/acme/tools-copy.git

  Scenario Outline: Adding a marketplace a scope already holds to the other scope records it in both
    Given the marketplace "tools" is published as a <source kind> source
    Given the marketplace "tools" is added to the user scope
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:             # cascade / info / false
    Then the result lists these marketplaces:     # tools | project | added
    Then the "claude-plugins.json" file of the user scope declares these marketplaces:      # tools | <source>
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:   # tools | <source>
    Examples: dir, file;  @url Examples: url;  @github Examples: github (acme/tools)

  Scenario Outline: Adding a source that does not exist fails as source missing, named as typed
    Given the directory "empty" to add holds no marketplace manifest
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:             # cascade / error / false / summary
    Then the result lists these marketplaces:     # <source> | project | failed | source missing
    Examples:   | source |  (untagged, no source kind column)
      {home}/marketplaces/missing | ~/marketplaces/missing |
      {home}/marketplaces/missing/.claude-plugin/marketplace.json | {home}/marketplaces/empty

  Scenario Outline: Adding a marketplace whose manifest is broken fails as invalid manifest
    Given the marketplace "tools" is published as a <source kind> source
    Given the manifest of the marketplace "tools" to add <manifest problem>
    When the user runs "/claude:plugin marketplace add <source> --scope project"
    Then the result has these fields:             # cascade / error / false / summary
    Then the result lists these marketplaces:     # <source> | project | failed | invalid manifest
    Examples:       | manifest problem | source kind | source |   4 rows: {is not valid json, breaks the manifest schema} × {dir, file}
    @url Examples:  | manifest problem | source kind | source |   2 rows: both problems × url

  Scenario: Adding a marketplace with --local declares it only in the local configuration
    Given the marketplace "extras" is published as a dir source
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "extras" is added to the project scope
    When the user runs "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"
    Then the result has these fields:             # cascade / info / false
    Then the result lists these marketplaces:     # tools | project | added
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:        # extras | {home}/marketplaces/extras
    Then the "claude-plugins.local.json" file of the project scope declares these marketplaces:  # tools  | {home}/marketplaces/tools
```

The `@url` row values (`https://{git host}/acme/...`) follow the ADD-01 seed (`add.feature:26-29`); Phase 9 confirms the exact source and row names for url failures. The `@github` row follows `add.feature:31-34` (`acme/tools`).

## Manifest Cache and Tokens (Q4)

### The cache persists across scenarios in a worker

`domain/manifest.ts:141` holds a process-lifetime cache: `const manifestCache = createManifestCache(loadMarketplaceManifestUncached);` keyed per path by `(mtimeMs, size)`, and it stores failed parses ("negative entries re-throw the EXACT value the loader threw") [VERIFIED: domain/manifest-cache.ts:15-18, 91-98, 130-131]. A `stat` failure is never cached [VERIFIED: manifest-cache.ts:82-89].

`.planning/research/PITFALLS.md:253` says "Pi loads extensions with `moduleCache: false`, so `new_session` builds a fresh cache." **The probe refutes this for the cucumber harness.** Same path, same size, exact same mtime (copied with `touch -r`), with a `new_session` between the broken and the valid write:

```
===== CACHE new session resets, same size, exact mtime
> /claude:plugin marketplace add {home}/marketplaces/tools --scope project
[{...,"severity":"error",...,"reasons":["invalid manifest"],...}]
  (new session)
> /claude:plugin marketplace add {home}/marketplaces/tools --scope project
[{...,"severity":"error",...,"reasons":["invalid manifest"],...}]      <- negative entry served after new_session
```
(The same-session control gave the same result, with `mtimes equal: true` printed.) So the run's one Pi per worker keeps every manifest-cache entry for the whole run, across scenarios. [VERIFIED: real Pi probe, output above]

**Which writes can collide:** every scenario writes `{home}/marketplaces/tools/.claude-plugin/marketplace.json` (the same absolute path in a worker, because the sandbox HOME is fixed for the run, `features/support/pi-process.ts:232-250`). A stale entry is served only when the path, the size, **and** the mtime all match. Across scenarios the mtime differs (≥ a session start, ~50 ms, separates the writes), and on this machine even back-to-back writes on `/tmp` (tmpfs) got distinct nanosecond mtimes (200/200 pairs). On a coarse-timestamp filesystem (some CI overlays) two writes inside one timestamp tick can share an mtime. [VERIFIED: local measurement; ASSUMED: CI filesystem granularity]

**Rule for the fixtures:** within one path, every distinct content must have a distinct size. Sizes for "tools": valid 57 bytes, schema-invalid (`"plugins":"nope"`) 61 bytes, recommended malformed (valid minus last `}`) 56 bytes. [VERIFIED: computed with `JSON.stringify` this session] Phase 3's scenarios never read a manifest and then rewrite it inside one scenario (ADD-07 publishes, breaks, then adds once), so they are safe; the size rule protects the existing INFO-08/UPD scenarios that do read-then-rewrite, and any future one. The `tools-copy` and `empty` paths are distinct from `tools`.

### Tokens for the ADD-06 rows

- `{home}` expands in a typed command and projects back by exact substring [VERIFIED: features/lib/run-tokens.ts:128-144]. A row typed as `{home}/marketplaces/missing` reports `name: "{home}/marketplaces/missing"`.
- `~/marketplaces/missing` is typed literally: `~` is not a token (features.md "A token never uses `~`, because the product prints `~` itself"), the step expands only `{home}`, and the product echoes the `~` form unchanged (P5). Phase 1 D-04 limits `~/` to ADD-14 and INFO-01; D-03 of this phase adds the ADD-06 row by decision, so it is sanctioned.
- `{home}/marketplaces/missing` resolves under the sandbox HOME, never the user's, because Pi's HOME is the sandbox (`tests/e2e/_rpc.ts:168-173`, `HOME: sandbox.home`) and `expandTildePath` uses `os.homedir()` in Pi's process [VERIFIED: add.ts:1143-1149].

## Setup Steps (Q5)

- `Given the user has run {string}` runs the strict driver (`runCommand`: exactly one `cascade`) and asserts `severity: "info"`, after expanding tokens [VERIFIED: command.steps.ts:101-104; pi-commands.ts:87-95]. `add ... --local` emits one info cascade (P7), so this step does the `--local` setup in `remove.feature` with no new step.
- `Given the marketplace {string} is added to the {word} scope` types the recorded source with `--scope <word>` through the same strict driver [VERIFIED: publishing.steps.ts:117-127]. It does ADD-05's user-scope add and D-06's base entry. It cannot add `--local` (no flag); use `the user has run` for that.
- ADD-13's add scenario needs no `--local` Given (the `--local` add is the `When`).

## Runtime (Q6)

| Command | Measured | Notes |
|---|---|---|
| `npm run test:cucumber` (today: 26 scenarios, 206 steps) | 4.8 s wall, 15.0 s scenario time over 8 workers (~0.6 s per scenario incl. reset) | `cucumber.json` `parallel: 8`, `order: random` |
| `npx cucumber-js --name '<title>'` | 4.7 s wall (starts 8 Pis, 16 hooks) | `--name` is a **regular expression** matched as a substring; an Outline title runs every untagged row |
| `npx cucumber-js --parallel 1 --name '<title>'` | 4.4 s wall, 1.5 s scenario time (one Pi) | Preferred per-task verify; lighter on CPU |
| `npm run check:features` | 1.6 s | Also runs inside `check:static` and the commit hook |
| A single `add` command in Pi | 2-27 ms; a session reset ~50-65 ms; first session ~1.3 s | Probe timings |
| `npm run check` (phase gate) | ~102 s wall at the end of the previous suite phase | [CITED: .planning/phases/01-suite-foundation/01-05-SUMMARY.md:145] |

Phase 3 adds about 15 executed scenarios (ADD-02 1, ADD-04 2, ADD-05 2, ADD-06 4, ADD-07 4, ADD-13 1, remove 1), raising the suite to ~41; expect `test:cucumber` to stay under ~7 s wall. [ASSUMED: linear scaling from the measured per-scenario cost]

Scenario titles in this phase contain `--local` and `~`; neither is a regex metacharacter, but avoid `(`, `)`, `?`, `+`, `[` in titles, or escape them in `--name`.

## Common Pitfalls

### Pitfall 1: A `severity` column in a failed-row table
**What goes wrong:** the table copied from CONTEXT's "Established Patterns" bullet includes `severity`, and the step fails with an extra/missing column.
**Why:** the wire block has no `severity` (see P4 correction).
**How to avoid:** state `| severity | error |` in `the result has these fields:`; the row table is `name | scope | status | reasons`.

### Pitfall 2: Forgetting `summary` in a failure envelope
**What goes wrong:** the envelope table for an error result lists kind/severity/needs reload only and fails, because `summary: "A marketplace operation has failed."` is present on every error payload.
**How to avoid:** every ADD-04/06/07 envelope table has four rows: `kind`, `severity`, `needs reload`, `summary`. Success tables have three (no `summary`, no `tally`).

### Pitfall 3: A step committed without its first use (or vice versa)
**What goes wrong:** the commit hook runs `check:features`; an unused definition or an undefined step in any row (including `@url`/`@github`) fails the commit.
**How to avoid:** each task commits a new step together with the scenario that first uses it. A step promoted to a shared module (D-08) moves in its own commit, still used.

### Pitfall 4: `the result lists these marketplaces:` skipped
**What goes wrong:** every result here has a non-empty `marketplaces` array; a scenario that only states fields fails in the `After` hook ("no step compared these rows") [VERIFIED: world.ts:162-168].
**How to avoid:** every scenario has a row step.

### Pitfall 5: A config `Then` after a failure that wrote nothing
**What goes wrong:** ADD-06/07 failures leave the project `claude-plugins.json` absent (P5, P6: `ENOENT`); the config step fails on a missing file by design.
**How to avoid:** D-05 already says ADD-06/07 check the result only. ADD-04's config check is fine because its Given add wrote the file.

### Pitfall 6: Overwriting the world's `tools` record from the second-publish step
**What goes wrong:** `recordPublished("tools", ...)` from the ADD-04 v2 step replaces the first record; a later `is added to the ... scope` would type `tools-copy`.
**How to avoid:** order the Givens with the first add before or after as you like, but never record the copy under `tools`.

### Pitfall 7: Same-size manifest rewrites
**What goes wrong:** a malformed fixture the same size as the valid manifest at the same path can be served from a stale cache entry on a coarse-mtime filesystem, across scenarios (the cache survives `new_session`).
**How to avoid:** malformed = valid minus one byte (56 vs 57 vs 61 bytes).

### Pitfall 8: Cloned lib switches
**What goes wrong:** copying `invalidateManifest`'s switch into a new malformed dispatcher, or `publishMarketplace` into a publish-in-directory twin, can create a ≥50-token clone that `fallow audit` (CI Lint workflow) flags as introduced.
**How to avoid:** parameterize the existing dispatchers; run `npx fallow dupes` after lib edits.

### Pitfall 9: Relying on a reload in the `--local` scenarios
**What goes wrong:** a new session between `add --local` and the checks hits the confirmed D-08 leak when the scope had no base file.
**How to avoid:** D-06's base entry first, and no new session in either `--local` scenario. With the base seeded, the base file stays clean even across a new session (probe below).

## D-08 Leak Confirmation (informational, for Phase 3.1 only)

```
===== first add of a scope is --local, then a new session
> add {home}/marketplaces/tools --scope project --local      → added
  project/claude-plugins.json: ENOENT
  project/claude-plugins.local.json: { "schemaVersion": 1, "marketplaces": { "tools": { "source": "{home}/marketplaces/tools" } } }
  (new session)
  project/claude-plugins.json: { "schemaVersion": 1, "marketplaces": { "tools": { "source": "{home}/marketplaces/tools" } }, "plugins": {} }   <- leak
===== D-06 seeded base, --local, then a new session
  (new session)
  project/claude-plugins.json:       { "schemaVersion": 1, "marketplaces": { "extras": { ... } } }   <- clean
  project/claude-plugins.local.json: { "schemaVersion": 1, "marketplaces": { "tools":  { ... } } }
```
[VERIFIED: real Pi probe] D-08's "not yet confirmed on a real Pi" is now confirmed. Phase 3 plans nothing for it.

## Code Examples

Malformed-JSON fixture (shape only; names the writer's):
```ts
// features/lib/path-marketplace.ts
// One byte shorter than the valid manifest, so a manifest cache keyed by
// modification time and size never serves the valid parse for it.
export async function writeMalformedManifest(root: string, name: string): Promise<void> {
  await writeFile(manifestPath(root), manifestText(name, []).slice(0, -1));
}
```
where `manifestText(name, plugins)` is the existing `JSON.stringify({ name, owner: { name: "features" }, plugins: ... })` from `writeMarketplace` (`path-marketplace.ts:146-157`), extracted once.

## State of the Art

| Old belief | Current fact | Source | Impact |
|---|---|---|---|
| `new_session` rebuilds the manifest cache (PITFALLS 12) | The cache survives `new_session` in the harness Pi | probe this session | Size rule applies across scenarios, not only within one |
| Failed add row carries `severity: "error"` (CONTEXT) | Wire block has no `severity`; severity is the envelope's | notification-wire.ts:297-307 + probe | Row tables omit `severity` |
| D-08 leak unconfirmed | Confirmed | probe | Phase 3.1 input only |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CI filesystems may have coarse mtime granularity, so same-size rewrites could collide there | Manifest Cache | Low: the size rule makes it moot |
| A2 | Suite runtime scales linearly to ~41 scenarios (< ~7 s wall) | Runtime | Low: planning estimate only |
| A3 | Phase 9 will keep `https://{git host}/acme/<name>.git` as the url source and report the typed URL as the failed-row name for url `invalid manifest` | Skeletons | Low: excluded rows never run in Phase 3; Phase 9 adjusts cells |

## Open Questions

1. **Verb-named Given text reads awkwardly.**
   - What we know: CONTEXT puts add-only steps in `add.steps.ts`; layout.md requires verb-module text to name the verb.
   - What's unclear: whether the reviewer accepts "to add" phrasing in fixture Givens, or would rather see these as publishing steps.
   - Recommendation: follow CONTEXT (add.steps.ts, "to add" phrasing as in the examples). If a second verb (UPD-10/INFO-08 malformed variants) later needs one, promote it to `publishing.steps.ts` in its own commit (D-08).
2. **Option 1 vs Option 2 for `remove --local`.** Recommendation: Option 1 (no new step; stronger). Phase 3.1 may need a zero-declaration or "file absent" read step for its own SC2; that is its decision.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | cucumber, Pi | ✓ | v26.11.1 local (CI runs 24) | — |
| `@cucumber/cucumber` | runner, gate | ✓ | 13.3.0 | — |
| Pi (`@earendil-works/pi-coding-agent`, repo dev dep) | headless Pi | ✓ | per lock | — |
| `/tmp` outside the repo | sandbox (`resolveSandbox` refuses locations inside the repo or outside `tmpdir()`) | ✓ | tmpfs | set `TMPDIR` outside the repo |

No network needed: every Phase 3 row that runs is dir or file; Pi runs with `PI_OFFLINE=1` [VERIFIED: tests/e2e/_rpc.ts:168-173].

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | cucumber-js 13.3.0 + `scripts/check-features.mjs` gate + ESLint `features/` blocks |
| Config file | `cucumber.json` (default profile `tags: "not @url and not @github"`, `parallel: 8`, `order: random`) |
| Quick run command | `npx cucumber-js --parallel 1 --name '<scenario title>'` (~4.4 s); `npm run check:features` (~1.6 s) |
| Full suite command | `npm run test:cucumber` (~5-7 s); phase gate `npm run check` (~100+ s) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADD-01 | Records under the manifest name in the chosen scope | behavioral (seeded) | `npx cucumber-js --parallel 1 --name 'Adding a marketplace records it in the chosen scope'` | ✅ add.feature |
| ADD-02 | No `--scope` → user scope | behavioral | `npx cucumber-js --parallel 1 --name '<ADD-02 title>'` | ❌ new scenario |
| ADD-03 | Listed after a new session | behavioral (seeded) | `npx cucumber-js --parallel 1 --name 'An added marketplace is still listed in a new session'` | ✅ |
| ADD-04 | Duplicate name, both variants | behavioral Outline | `--name '<ADD-04 title>'` (runs both dir rows) | ❌ new |
| ADD-05 | Both scopes independently | behavioral Outline | `--name '<ADD-05 title>'` (dir, file rows) | ❌ new |
| ADD-06 | Source missing, four spellings, named as typed | behavioral Outline | `--name '<ADD-06 title>'` (4 rows) | ❌ new |
| ADD-07 | Invalid manifest, both problems × dir/file | behavioral Outline | `--name '<ADD-07 title>'` (4 rows) | ❌ new |
| ADD-13 | `add --local` → local file only; `remove --local` clears it | behavioral | `--name '<ADD-13 add title>'`; `--name '<remove --local title>'` | ❌ new (remove.feature new) |
| ADD-14 | `~` kept, resolved against HOME | behavioral (seeded) | `--name 'home-relative path'` | ✅ |
| all | every row (incl. `@url`/`@github`) matches exactly one step; no unused step; Gherkin/layout rules | static gate | `npm run check:features` | ✅ |

**Failing direction (what proves each scenario is not vacuous):** each new scenario must be watched failing once by hand against a plausible wrong expectation, not committed as a negative control (CONVENTIONS: "Do not commit negative controls"). Useful by-hand checks: ADD-04 v2 row with `<second source>` changed to the first source still passes but the v2 row is what fails if `newMarketplaceName` compared sources; ADD-06 `~` row fails if the table cell is changed to `{home}/marketplaces/missing` (proves "as typed"); ADD-13 fails if the base-file table also lists `tools`; remove fails if the local table lists nothing or both. `check:features` failing direction: temporarily misspell a step in an `@url` row and see an "undefined step" finding.

### Sampling Rate
- **Per task commit:** the hook runs `check:commit` (includes `check:features`); run `npx cucumber-js --parallel 1 --name '<title>'` for the scenarios the task adds, then `npm run test:cucumber`, before committing (the hook does not run cucumber).
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree before `/gsd-verify-work`.

### Wave 0 Gaps
None for infrastructure: the runner, driver, tokens, config read step, and gate all exist. New files are the scenarios' own: `features/step_definitions/marketplace/add.steps.ts`, `features/marketplace/remove.feature`, and the lib modes in `features/lib/{path-marketplace,published-marketplace}.ts`.

## Security Domain

Test-only phase; no production surface changes.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (url/github rows excluded until Phases 9/10) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no new surface | Driver validates every payload against `NOTIFICATION_PAYLOAD_SCHEMA` (existing) |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A scenario or probe writes into the developer's real `~/.pi/agent` or HOME | Tampering | `resolveSandbox` refuses sandbox locations outside `tmpdir()` or inside the repo; Pi child env is an allowlist with `HOME`/`PI_CODING_AGENT_DIR` set to the sandbox [VERIFIED: tests/e2e/_rpc.ts:134-173] |
| A scenario reaches the network | Information disclosure | `PI_OFFLINE=1`; only dir/file rows run; url/github fixtures throw `noStandIn` |

## Sources

### Primary (HIGH confidence)
- Real headless Pi probes this session (two scripts importing `features/lib/pi-process.ts` / `pi-commands.ts`, hermetic `mkdtemp` sandbox; deleted afterwards).
- Read this session: `features/**` (all step, support, lib modules; `add.feature`, `list.feature`, `info.feature`), `scripts/check-features.mjs`, `cucumber.json`, `package.json` scripts, `.pre-commit-config.yaml:107-112`, `eslint.config.js:258-370`, `.fallowrc.json`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (classify, name, subject, failed row, path guard), `remove.ts:770-860`, `domain/manifest.ts:95-155`, `domain/manifest-cache.ts`, `persistence/config-write-back.ts:83-111`, `shared/notification-wire.ts:225-372`, `shared/notification-resolve.ts:300-410`, `shared/redact-absolute-paths.ts`, `tests/e2e/_rpc.ts:130-406`.
- `.agents/skills/cucumber/**`, `.agents/skills/local-verification/**`, `.agents/skills/committing/SKILL.md`.

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` (MF-ADD-*), `.planning/research/PITFALLS.md` (Pitfall 12, refuted in part), `.planning/phases/01-suite-foundation/01-RESEARCH.md`, `01-05-SUMMARY.md`.

## Metadata

**Confidence breakdown:**
- Wire payloads: HIGH (read off a real Pi, schema-validated by the driver)
- Gate rules: HIGH (script read in full)
- Step placement and wording: MEDIUM (locked by CONTEXT; wording is the writer's and reviewer-judged)
- Cache behavior: HIGH for "survives `new_session`" (probe); MEDIUM for CI mtime granularity

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable; re-probe if `orchestrators/marketplace/add.ts`, `notification-wire.ts`, or the harness changes)
