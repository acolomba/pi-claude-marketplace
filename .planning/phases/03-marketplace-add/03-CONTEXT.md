# Phase 3: Marketplace Add - Context

**Gathered:** 2026-10-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 completes the `marketplace add` scenarios in `features/marketplace/add.feature`, which Phase 1 seeded with the ADD-01 and ADD-03 Outlines and the ADD-14 scenario. It covers ADD-01..ADD-07, ADD-13, and ADD-14:

- the default scope (ADD-02);
- the scenarios already seeded (ADD-01, ADD-03, ADD-14);
- duplicate name (ADD-04);
- both scopes (ADD-05);
- source missing (ADD-06);
- invalid manifest (ADD-07);
- `--local` (ADD-13).

It also creates `features/marketplace/remove.feature` holding the single `remove --local` scenario (D-07).

A behavior shared by several kinds is one Outline. Its dir and file rows pass now. Its `@url` and `@github` rows wait for Phases 9 and 10, and this phase writes all three blocks. Steps that only `add` uses go in `features/step_definitions/marketplace/add.steps.ts`. Steps that a second verb needs go in `marketplace/publishing.steps.ts` or `config.steps.ts`, in their own commit (01-CONTEXT D-06, D-08).

This phase changes no production code. The `--local` leak found during discussion is fixed in the inserted Phase 3.1 (D-08).

**Upstream parity:** none applies. Phase 3 adds scenarios that pin how `marketplace add` already behaves, and where the code and the docs disagree the milestone pins the code (C-1..C-13). The two conflicts about add (C-1, the shape of the auth failure row, and C-12, the missing credential hint) belong to the url and github rows in Phases 9 and 10.

</domain>

<decisions>
## Implementation Decisions

### Duplicate name (ADD-04)
- **D-01:** One Outline with two variants: the same source added twice, and a second marketplace published from another directory whose manifest declares the same name. Each variant has a dir row and an `@url` row. The duplicate check compares only the manifest name (`newMarketplaceName`), so only the second variant catches an implementation that compares sources instead.
- **D-02:** The scenario checks the whole failed result: the envelope (`cascade`, error severity, no reload, the failure summary) and the failed row (the manifest name, `failed`, `duplicate name`). It also checks that the scope's `claude-plugins.json` still declares the original source, which catches an add that reports the duplicate but still overwrites the record. (Research correction: the wire row carries no `severity` field, so severity is stated in the envelope table.)

### Failure inputs (ADD-06, ADD-07)
- **D-03:** ADD-06 is one Outline with local rows only, one for each of four spellings:
  - a missing absolute directory, `{home}/marketplaces/missing`;
  - the `~/` form, `~/marketplaces/missing`;
  - a missing manifest file path, `{home}/marketplaces/missing/.claude-plugin/marketplace.json`;
  - an existing directory with no `.claude-plugin/marketplace.json`.

  Each fails as `source missing`, and the row's name equals the source exactly as typed. The `~/` row is the one that tells "as typed" apart from "as resolved". The directory with no manifest fails on a different branch: reading the manifest fails, not the `stat`. The url 404 row is ADD-09 (Phase 9).
- **D-04:** ADD-07 is one Outline with a `<manifest problem>` column, malformed JSON or schema-invalid. That column is crossed with dir and file (four untagged rows) and with url (two `@url` rows). Each row fails as `invalid manifest`, named by the source as typed. Malformed JSON needs a new fixture mode beside `writeInvalidManifest`, chosen by source kind in `features/lib/published-marketplace.ts`. The url branch throws `noStandIn` until Phase 9.
- **D-05:** The ADD-06 and ADD-07 scenarios compare the whole failed result (its fields and the failed row) and check nothing more. These failures throw before anything is written, inside the locked transaction. A plausible wrong implementation names the wrong reason or the wrong subject, and the row check catches both.

### `--local` round trip (ADD-13)
- **D-06:** The `add --local` scenario first adds another marketplace without `--local`, so the base file exists. After `add --local`, the base `claude-plugins.json` declares only that first marketplace, and `claude-plugins.local.json` declares only the new one. Both checks use the existing read-only config step. This setup is also how real users meet `--local`, and it avoids the first-run migration path (D-08).
- **D-07:** The `remove --local` scenario lives in a new `features/marketplace/remove.feature` (`Feature: Marketplace remove`). Phase 3 creates it and Phase 4 extends it. This works because this run executes phases one at a time. A step that only `remove` uses goes in `features/step_definitions/marketplace/remove.steps.ts`. No reload or new session separates the add from the remove.
- **D-08:** A defect found while reading the code during discussion, and confirmed on a real Pi during research (03-RESEARCH.md, "D-08 Leak Confirmation").
  - **The leak.** `migrateFirstRunConfig` (`persistence/migrate-config.ts:181`, MIG-01) checks only the base file. In a scope whose first add was `--local`, `state.json` exists but `claude-plugins.json` does not. On the next load (`orchestrators/reconcile/apply.ts::readPassForScope`), `buildConfigFromState` therefore writes the base file from the records, and the `--local` marketplace goes with them. That puts a per-machine entry in the shared, possibly committed, base file.
  - **The consequence.** After that, `remove --local` clears the local entry and the record, but the base file still declares the marketplace, so the next reload adds it back.
  - **The decision.** The user chose to fix it test-first in an inserted Phase 3.1, under a new requirement FIX-02, as Phase 6 does for C-10. Phase 3's own scenarios never reload between `add --local` and their checks, so they pass on today's code.

### Both scopes (ADD-05)
- **D-09:** One Outline over every kind: dir, file, `@url`, and `@github`. Given the marketplace is added to the user scope, adding it with `--scope project` succeeds (`added`, `project`), and each scope's `claude-plugins.json` declares it. Each git kind makes a second clone into the other scope's root, the step most likely to break if a clone key or the leftover-clone check is shared between scopes. Listing both rows (LS-02) and removing one of them (RM-08) stay in Phase 4.

### Claude's Discretion
- ADD-02 is a single dir scenario: an absolute path with no `--scope`, a row reading `user`, and the user scope's `claude-plugins.json` declaring it. The research found one kind enough (MF-ADD-02).
- The exact step wording (layout.md: step text belongs to the writer). That includes the step that publishes a marketplace in a directory whose manifest declares another name, the fixture for a directory with no manifest, and the content of the malformed JSON.
- How the `remove --local` scenario shows the local entry is gone. Option 1 is a second local entry that stays. Option 2 is a new read step for a file that exists with an empty `marketplaces` map; `remove` keeps the file and writes `marketplaces: {}`, and `config.steps.ts` asks a zero-declaration step to say which of the two cases it means. Whichever is chosen, the base file is seeded as in D-06 and stays untouched.
- Which scope the `--local` scenarios use. The project scope, whose base file a team commits, is where a per-machine layer matters most.
- Any tightening of the ADD-01, ADD-03, and ADD-14 seeds that a cucumber-skill review asks for.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md`: Phase 3's goal and success criteria SC1-SC3; the source-kind strategy (Outlines, tag blocks, disjoint verb files); the milestone invariants (what a `Then` may observe; pin the code over the docs)
- `.planning/REQUIREMENTS.md`: ADD-01..ADD-07, ADD-13, ADD-14; FIX-02 once Phase 3.1 is inserted

### Prior decisions
- `.planning/phases/01-suite-foundation/01-CONTEXT.md`:
  - D-01: a `kind` row in every result.
  - D-02: multi-payload steps.
  - D-03, D-04: `{home}` tokens; fixtures under `{home}/marketplaces/<name>`; `~/` only in ADD-14 and INFO-01.
  - D-05: `{scenario time}`.
  - D-06, D-08: verb and shared step modules.
  - D-07: config steps only read.
  - D-09, D-10: the usage gate over every row.

### Research
- `.planning/research/FEATURES.md`: MF-ADD-01..MF-ADD-14 (the observable result of each); C-1..C-13 (where code and docs disagree)
- `.planning/research/PITFALLS.md`:
  - the manifest cache is keyed by mtime and size, and it caches failed parses;
  - over-normalizing hides wrong paths;
  - the driver must stay strict.
- `.planning/research/ARCHITECTURE.md`: what a `Then` may observe; the patterns the driver and steps follow

### Cucumber rules
- `.agents/skills/cucumber/SKILL.md`, `.agents/skills/cucumber/rules/layout.md`, `.agents/skills/cucumber/rules/features.md`, `.agents/skills/cucumber/rules/steps.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`: the Outline and tag-block rules, the verb and shared step modules, whole-value tables, and one behavior per scenario

### Code under test
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`:
  - `classifyAddError` (about line 286): the closed set of reasons;
  - `newMarketplaceName` (about line 336): the duplicate check, keyed on the name, which throws before anything is written;
  - `addSubjectName` (about line 366): the failure subject is the typed source, or the manifest name for a duplicate;
  - `failedAddRow` (about line 559): the failed row has no cause, except under the GitHub override;
  - the `--local` target path (about line 435);
  - `addPathInGuard` (about line 1081): `~` is expanded only for the disk lookup.
- `extensions/pi-claude-marketplace/domain/manifest.ts`: malformed JSON and a schema-invalid manifest both become `InvalidMarketplaceManifestError`, and a missing manifest file stays ENOENT (`source missing`)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`: the `--local` target path (about line 805)
- `extensions/pi-claude-marketplace/persistence/config-write-back.ts`: `deleteMarketplaceConfigEntryWithCascade` keeps the file and writes an empty map
- `extensions/pi-claude-marketplace/persistence/migrate-config.ts` (`migrateFirstRunConfig`, about line 181) and `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (`readPassForScope`, about line 159): the D-08 leak

### Suite code
- `features/marketplace/add.feature`: the Phase 1 seeds
- `features/step_definitions/command.steps.ts`, `features/step_definitions/config.steps.ts`, `features/step_definitions/marketplace/publishing.steps.ts`
- `features/lib/published-marketplace.ts`, `features/lib/path-marketplace.ts`, `features/lib/field-rows.ts`, `features/lib/run-tokens.ts`, `cucumber.json`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
These steps already exist:
- `the marketplace {string} is published as a {source kind} source`
- `the marketplace {string} is added to the {word} scope`
- `the user has run {string}` (a setup command that must succeed)
- `the user runs {string}`
- `the result has these fields:`
- `the result lists these marketplaces:`
- `the {string} file of the {word} scope declares these marketplaces:`
- `the manifest of the marketplace {string} has become invalid`, which is schema-invalid and phrased for after an add

`publishMarketplace` and `invalidateManifest` choose their behavior by source kind; url and github throw `noStandIn` until Phases 9 and 10.

### Established Patterns
- A failed add row reads `{name, scope, status: "failed", reasons: [reason], plugins: []}` on the wire, with no cause (SNM-10) and no `severity` (the payload envelope carries severity `error` and the summary). The tables therefore do not change across Node versions. Only under the GitHub base override does a synthetic child row carry the fetched URL (Phase 10).
- `check:features` dry-runs every row, the excluded ones included. A tagged block must have a `source kind` column. An untagged block holds only dir and file rows, and a kind-less local Outline such as ADD-06 needs no `source kind` column.
- Each worker reuses one HOME path, so the same fixture path recurs across scenarios. The manifest cache keys on mtime and size and remembers a failed parse until the file changes, and research showed the cache also survives a new session within one worker. Every manifest content written at one path must therefore have its own size (03-RESEARCH.md: valid 57 bytes, schema-invalid 61, malformed 56).
- A config file that does not exist is not "zero declarations": the extension rebuilds a missing base file from its records on the next load (MIG-01, and the D-08 leak).

### Integration Points
- New `features/step_definitions/marketplace/add.steps.ts` (the verb module); new `features/marketplace/remove.feature` and possibly `features/step_definitions/marketplace/remove.steps.ts`
- Possibly a new read step in `features/step_definitions/config.steps.ts`; new fixture modes in `features/lib/published-marketplace.ts` and `features/lib/path-marketplace.ts` (malformed JSON, a directory under another name, a directory with no manifest)

</code_context>

<specifics>
## Specific Ideas

An illustrative ADD-04 shape (the writer chooses the wording):

```gherkin
Scenario Outline: Adding a name the scope already holds fails as a duplicate
  Given the marketplace "tools" is published as a <source kind> source
  Given the marketplace "tools" is added to the project scope
  Given ...a second marketplace declaring the name "tools" is published at "tools-copy"...
  When the user runs "/claude:plugin marketplace add <second source> --scope project"
  Then the result lists these marketplaces:
    | name  | scope   | status | reasons        |
    | tools | project | failed | duplicate name |
  Then the "claude-plugins.json" file of the project scope declares these marketplaces:
    | name  | source   |
    | tools | <source> |

  Examples:
    | source kind | source                    | second source                  |
    | dir         | {home}/marketplaces/tools | {home}/marketplaces/tools      |
    | dir         | {home}/marketplaces/tools | {home}/marketplaces/tools-copy |
```

The `@url` block follows the same two variants.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 3.1 (inserted after Phase 3): the `--local` leak (D-08), under FIX-02.** The requirement, stated as behavior and not as a mechanism: after `add --local` and a reload, `claude-plugins.json` does not declare the marketplace; after `remove --local` and a reload, the marketplace stays removed. The scenario is written first and must fail on today's code. The fix phase's own discussion settles the mechanism and any parity question about Claude Code's local settings layer (SC-1 declines the `local` scope).
- Phase 4 should check what `remove` without `--local` does to a marketplace declared only in `claude-plugins.local.json`. This was not verified here.
- Listing both scopes (LS-02) and removing one of two scopes' entries (RM-08) stay in Phase 4.

### Reviewed Todos (not folded)
- `2026-10-13-cucumber-rules-trial` (§3, porting the cucumber skill and gates to `acolomba/blueprint-typescript`): it matched only on keywords, and it concerns another repository.

</deferred>

---

*Phase: 03-marketplace-add*
*Context gathered: 2026-10-16*
