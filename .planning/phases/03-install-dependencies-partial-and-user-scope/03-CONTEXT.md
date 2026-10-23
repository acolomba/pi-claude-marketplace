# Phase 3: Install Dependencies, Partial, and User Scope - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 3 adds cucumber scenarios for four install behaviors: the dependency
closure (INS-01), a closure that cannot be resolved (INS-02), a partially
available plugin with and without `--partial` (INS-03), and installs into the
user scope (INS-04). It edits only `features/plugin/install.feature`,
`features/plugin/install-dependencies.feature`,
`features/plugin/partial-install.feature`, and, if a step is missing,
`features/step_definitions/plugin/install.steps.ts`. Test plugins carry skills
only. Product code changes only if a scenario exposes a bug.

</domain>

<decisions>
## Implementation Decisions

### Upstream position (claude-code-compat-research)
- **D-01:** The phase touches the install lifecycle, so it was checked against
  the upstream contract as the project already records it:
  `docs/dependency-resolution.md` (TAGS-02, D-07-03, D-03-36) and
  `domain/unsupported-components.ts` (audited against the Claude Code 2.1.291
  binary on 2026-10-06). No Claude Code binary is installed on this machine
  (`~/.local/share/claude/versions/` is absent), so no new binary evidence was
  gathered; confidence is medium, resting on the recorded audits. No scenario
  of this phase needs a divergence from them.

### Dependency closure (INS-01)
- **D-02:** The closure scenario uses a three-level chain, `app` -> `lib` ->
  `base`, so a transitive member is proven, not just a direct one. The result
  lists one `installed` row per member, the installation record of the project
  scope holds all three, and a new session offers all three skills.
- **D-03:** Dependency order is not observable from outside: the cascade sorts
  its rows by name (`composeCascadeMemberRows` → `compareByNameThenScope`), and
  the record is keyed by id. The scenarios prove the whole closure lands; the
  post-order install sequence stays covered by the unit tests of
  `domain/dependency-closure.ts` and `install-cascade.ts`. No step reads
  internal ordering.
- **D-04:** The Phase 1 seed (a `lib@^1.0.0` constraint with no marketplace
  tag) stays as it is. It proves TAGS-02: a constraint no tag satisfies
  installs the current copy with `{dependency current copy}`, as Claude Code
  does (Claude Code warns; this project notes it at info severity, D-07-03).

### Unresolvable closure (INS-02)
- **D-05:** "A version constraint no offered version satisfies" maps to the
  install-time refusals the product actually has for path-source plugins:
  `{version conflict}` from two declarations that do not overlap (`app` needs
  `lib@^1.0.0` and `mid`, `mid` needs `lib@^2.0.0`), and
  `{already installed, version conflict}` when the copy already installed
  falls outside the constraint. A path-source constraint that merely matches
  no tag does not fail (D-04, TAGS-02), so it is not an INS-02 case. A
  `{no matching version}` refusal needs a git-source dependency with a tag
  list and belongs to the git-source phase.
- **D-06:** The missing-dependency scenario uses a transitive gap (`app` ->
  `lib` -> missing `base`), so the failure proves that a member that resolves
  (`lib`) is not installed either. Rows: `app` `{dependency failed}`, `base`
  `{not in manifest}` with its cause.
- **D-07:** "Installs nothing" is shown three ways in each failure scenario:
  the scope has no installed plugins (record and staged skills), `list
  --scope project` shows every member `available`, and a new session offers no
  skills. Each is its own scenario when it needs its own `When`.

### Partial install (INS-03)
- **D-08:** The Phase 1 seed (refusal without `--partial`) stays. New
  scenarios: `--partial` installs the plugin `partially-installed` with
  `{unsupported component}`, a new session offers its skill, and `info` then
  reports `partially-installed`, `{unsupported component}`, and the skills it
  installed.
- **D-09:** `info` names the left-out component through the closed reason
  `{unsupported component}`. The specific kind (`outputStyles`) collapses to
  that reason by design (D-90-05 in `shared/probe-classifiers.ts`); `lsp`,
  `unsupported hooks`, and `unsupported mcp` are the only per-kind reasons.
  Not a bug. Claude Code has no partial install, so no upstream position
  applies. Naming the exact kind would add a wire field; it is out of scope.

### User scope (INS-04)
- **D-10:** Two installs are covered: no `--scope` and `--scope user`. Each
  gets a scenario that the result row reads `scope user`, the user scope's
  installation record holds the plugin, and the project scope holds none. The
  default scope is user, as in Claude Code.
- **D-11:** `list --scope project` after a user-scope install returns an empty
  result, even though the Background adds the marketplace to the project scope:
  list folds a plugin installed in the other scope out of the `available`
  bucket (`list-flow.ts`, the orphan-fold rule). The scenario states that
  result whole. The list rule itself belongs to the list phase.
- **D-12:** The existing seed covers a session in another project after
  `--scope user`; a new scenario covers it after an install with no `--scope`.
  Two variants of one behavior do not make an Outline (the Outline rule needs
  three).

### Phase 1 bug candidates
- **D-13:** Dependency row `name` is the qualified key (`lib@tools`): not a
  bug. RESV-06 and WIRE-04 name a cascade member by its own
  `<plugin>@<marketplace>` key because a dependency can come from another
  marketplace than the block it sits under (`rowId` in
  `shared/notification-json.ts` documents it).
- **D-14:** The `partially-available` refusal row has no `scope` and no
  `version`: not a bug. `wireScope` deliberately omits scope for the catalog
  statuses (`available`, `remote`, `unavailable`, `partially-available`), which
  describe what the marketplace offers, not a scope's state. The install gate
  refuses before the ledger captures a version, so every pre-ledger refusal
  (`not in manifest`, `already installed`, `partially-available`) carries no
  version; the row is consistent with them.

### Steps
- **D-15:** Every step the scenarios need already exists in Phase 1 modules.
  No `install.steps.ts` is created unless execution finds a gap.

### Claude's Discretion
- Scenario titles and the exact split of the "installs nothing" checks across
  scenarios, within the feature-file rules.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 3" and "File ownership"
- `.planning/REQUIREMENTS.md` INS-01..INS-04
- `.agents/skills/cucumber/SKILL.md` and `rules/{features,layout,steps}.md`
- `docs/dependency-resolution.md` (constraints, fallback, refusal reasons)
- `.planning/phases/01-suite-foundation/01-05-SUMMARY.md` (seeds, bug candidates)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts`
- `extensions/pi-claude-marketplace/shared/notification-json.ts` (`rowId`, `wireScope`, `wireVersion`)
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` (`kindToReason`)

</canonical_refs>

<deferred>
## Deferred Ideas

- Naming the exact unsupported kind in `info` (a new wire field) — a product
  enhancement, not an INS-03 bug (D-09).
- `{no matching version}` for a git-source dependency — git-source phase (D-05).

</deferred>
