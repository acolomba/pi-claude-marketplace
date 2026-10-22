# Phase 1: Suite Foundation - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 builds the shared cucumber machinery every later marketplace phase writes against, so the verb phases (3-8) and kind phases (9-10) never touch shared code:

- a driver that returns every payload a command emits, validates each against `NOTIFICATION_PAYLOAD_SCHEMA`, and asserts kinds and count (DRV-01);
- exact-token substitution for run-specific values, with `lastUpdatedAt` checked inside a time window (DRV-02);
- kind-neutral publishing, adding, result-table, and config steps, with dir and file fixtures;
- the `@url`/`@github` exclusion in `cucumber.json` and the multi-kind Outline pattern documented in the cucumber skill;
- a gate against unused, undefined, and ambiguous steps (DRV-04), plus the folded Gherkin/layout gate and ESLint blocks.

Requirements: DRV-01, DRV-02, DRV-04. No marketplace behavior is in scope beyond the seeded scenarios that use the shared steps (D-08).

Upstream parity: none applies. This is test infrastructure under `features/`, `scripts/`, `eslint.config.js`, and `cucumber.json`; no Claude Code contract is touched.

</domain>

<decisions>
## Implementation Decisions

### Payload-kind assertions
- **D-01:** Every result is stated with a `kind` row: `kind` is removed from the hidden fields of `the result has these fields:`, so a table reads `| kind | marketplace-info |`. The 13 existing plugin scenarios gain `| kind | cascade |`. Wire kind literals are written as-is (hyphenated).
- **D-02:** A command that emits several payloads (a bare `update`: one cascade per marketplace, project scope first) is compared in two whole-value steps: an envelope table with one row per payload in emission order (kind, severity, needs reload, summary), which pins count, order, and kinds; then a rows step listing the marketplace rows (and plugin rows, when present) across every payload in order. Single-payload steps keep asserting exactly one payload (never filter for "the" result).

### Run-specific tokens
- **D-03:** Tokens use braces: `{home}` now, `{git host}` in Phase 9, and one per sandbox root that can appear in output. Not `<...>` (Outline placeholders, and the usage text prints `<source>`/`<name>`), not `~` (the product prints `~` legitimately, ADD-14), not `$HOME`. Commands expand tokens to real values; result cells are projected back by exact substring only. Examples cells may carry tokens: `| dir | {home}/marketplaces/tools |`, with the row's source reaching steps through an ordinary `<source>` Examples column.
- **D-04:** Dir and file fixtures live under the sandbox HOME (`{home}/marketplaces/<name>`), and commands type the absolute path through `{home}`. The `~/...` form is exercised only by ADD-14's own scenario and by INFO-01, which types `~/marketplaces/tools` and expects `{home}/marketplaces/tools` so an info that echoes the typed source fails (user ruling on review finding CR-02, 2026-10-15). The `file` kind is `<root>/.claude-plugin/marketplace.json` (research C-10 note); a manifest outside `.claude-plugin/` belongs to Phase 6's C-10 scenario.
- **D-05:** A `last updated at` cell reads `{scenario time}`: any valid ISO timestamp between the scenario's start and the check projects to it; anything else (stale, epoch, future, malformed) stays literal and fails.

### Shared steps and the unused gate
- **D-06:** Phase 1 defines every step two or more verb phases need (inventory derived from the requirements), and gives each its first use in a real scenario in the verb feature file it belongs to (e.g., ADD-01's multi-kind Outline in `features/marketplace/add.feature`, a bare-update scenario in `update.feature`). The verb phase then owns and extends that file and completes its requirements. No throwaway smoke feature, no allowlist; the gate is strict from Phase 1.
- **D-07:** Config steps only read: they compare a scope's `claude-plugins.json` and `claude-plugins.local.json` declarations. No config-write `Given` until a requirement needs one. ROADMAP Phase 1 SC3's "read and write" is narrowed to read accordingly.
- **D-08:** A step defined verb-local that a later verb phase also needs is promoted into the shared marketplace step module by the phase that finds the second use, in its own commit. Verb-local step text names its verb so two verbs never write the same text by accident.

### Usage gate
- **D-09:** The usage gate dry-runs every scenario, ignoring the `not @url and not @github` exclusion: a step only excluded rows use counts as used, and every step in an excluded row must match exactly one definition. CLI `--tags` is and-joined with the profile's tags, so the gate needs its own profile or the cucumber API. (Measured: the dry-run usage report honors tag filters; under `--tags @nonexistent` all 9 current definitions read UNUSED.)
- **D-10:** The gate runs in `check:static`, in the same `scripts/check-features.mjs` as the folded Gherkin/layout gate, so a commit touching a build input fails on an unused, undefined, or ambiguous step within seconds. The dry run starts no Pi.

### Claude's Discretion
- Exact step wording (layout.md: step text belongs to the writer), module split under `step_definitions/marketplace/`, the token set beyond `{home}`, and the window tolerance for `{scenario time}`.
- Renaming `PluginWorld` to `ScenarioWorld` (the skill's examples use `ScenarioWorld`).
- How `Given` setup commands use the driver (strict single cascade or the full payload driver).

### Folded Todos
- **`2026-10-13-cucumber-rules-trial`** (`.planning/todos/pending/`, `resolves_phase: 1`). §1 and §1b are already done (the layout became today's `step_definitions/` + `support/`); §2.4 is DRV-04. Folded:
  - §2.3: `scripts/check-features.mjs` in `check:static`, enforcing the current `features.md`/`layout.md` rules mechanically: file layout and catch-all names, file name = kebab-cased feature title without the function word, one feature per file with a non-empty description, no `And`/`But`, lower-case step text, no `should`, no `Given` after a `When`, `Background` holds `Given` only, scenario titles start upper case. Paths follow the current layout (`step_definitions/**/*.steps.ts`, `support/`, `lib/`), not the todo's older `steps/` paths.
  - §2.1-2.2, updated to the current rules: step modules export nothing and use Cucumber expressions only (no regex step text); `features/lib/**` may not import `Given`, `When`, `Then`, hooks, `setWorldConstructor`, or `defineParameterType`. The todo's named-function and `assert*`-name bullets are dropped: current `steps.md` requires anonymous `function` expressions and has no role-name rule.
  - Per CONVENTIONS.md, no committed negative controls for these gates; check each once by hand against a planted violation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, research flag; the source-kind strategy and milestone invariants
- `.planning/REQUIREMENTS.md` — DRV-01, DRV-02, DRV-04; the verb requirements that decide which steps are cross-verb (D-06)
- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md` — folded gates (§2.1-2.3)

### Research
- `.planning/research/SUMMARY.md` — decisions taken after research, pitfalls
- `.planning/research/ARCHITECTURE.md` — Patterns 2-3 (widened driver, symbolic addresses), anti-patterns, what a `Then` may observe
- `.planning/research/FEATURES.md` — C-10 note on the `file` kind; MF-* candidate scenarios
- `.planning/research/PITFALLS.md` — scenarios a wrong implementation still passes

### Cucumber rules
- `.agents/skills/cucumber/SKILL.md` and `.agents/skills/cucumber/rules/{layout,features,steps,world-and-stand-ins}.md` — the rules the suite and the new gates enforce; the Outline/exclusion pattern is documented here (SC4)

### Contract
- `extensions/pi-claude-marketplace/shared/notification-wire.ts` — `NOTIFICATION_PAYLOAD_SCHEMA` (line ~800) and every payload kind
- `extensions/pi-claude-marketplace/edge/router.ts:129-137` — `MARKETPLACE_USAGE` (prints `<source>`, `<name>`)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:257-300` — bare update: one notification per marketplace, project first

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/pi-commands.ts`: `runCommand` (strict single cascade) and `startSession`; widen into a payload-list driver beside it.
- `features/lib/path-marketplace.ts`: `writeMarketplace` / `readOfferedPlugins`; becomes the dir/file fixture, relocated under the sandbox HOME.
- `features/step_definitions/command.steps.ts`: `flatten`, `fieldWords`, `namesLike`, `pluginRecords` — the field-word table convention the new result steps extend.
- `features/support/pi-process.ts`: one Pi per worker, `Before()` empties HOME/agent/project and asserts an empty `list`.
- `tests/e2e/_rpc.ts`: `startRpcPi`, the process harness the driver reuses.

### Established Patterns
- Whole-value comparison: tables list every row; a field the result omits is a field the table omits.
- `cucumber.json` has `order: random`, `parallel: 8`; no `tags` yet.
- `features/**` is linted, typechecked, prettier-checked, and a build input for the commit hook and CI.

### Integration Points
- `cucumber.json` (`tags`, a gate profile), `package.json` `check:static`, `eslint.config.js` (new `features/` blocks), new `scripts/check-features.mjs`.
- New `features/marketplace/*.feature` files seeded by Phase 1 and owned afterwards by Phases 3-8.

</code_context>

<specifics>
## Specific Ideas

Illustrative shape agreed in discussion (wording is the writer's):

```gherkin
Scenario Outline: Adding a marketplace records it in the chosen scope
  Given the marketplace "tools" is published as a <source kind> source
  When the user runs "/claude:plugin marketplace add <source> --scope project"
  Then the result has these fields:
    | kind         | cascade |
    | severity     | info    |
    | needs reload | false   |
  Then the result lists these marketplaces:
    | name  | scope   | last updated at |
    | tools | project | {scenario time} |

  Examples:
    | source kind | source                                                    |
    | dir         | {home}/marketplaces/tools                                 |
    | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

  @url
  Examples:
    | source kind | source                            |
    | url         | https://{git host}/acme/tools.git |
```

</specifics>

<deferred>
## Deferred Ideas

- A config-write `Given` — added by the first phase whose requirement needs it (D-07).

### Reviewed Todos (not folded)
- `2026-10-13-cucumber-rules-trial` §3 (port the skill and gates to `acolomba/blueprint-typescript` draft PR #7): another repository; stays in the todo.

</deferred>

---

*Phase: 01-suite-foundation*
*Context gathered: 2026-10-15*
