# Roadmap: pi-claude-marketplace

## Milestones

- **marketplace-features** Marketplace Behavioral Tests — in progress, Phases 1-10, branch `features/cucumber-behavioral-tests`, started 2026-10-15
- **json-output** Mode-Keyed Presentation Strategies — completed 2026-10-11, merged to main 2026-10-11 (PR #251, squash `0e45ffd9`), not yet released; 9 phases, 50 plans, 36/36 requirements. [Archive](milestones/json-output-ROADMAP.md), [requirements](milestones/json-output-REQUIREMENTS.md), [audit](milestones/json-output-MILESTONE-AUDIT.md).
- **mcp-4 (MCP 4)** — completed 2026-10-10, merged to main 2026-10-10 (PR #250, squash `94160614`), released as 0.20.0; 8 phases, 73 plans, 41/41 requirements. [Archive](milestones/mcp-4-ROADMAP.md), [requirements](milestones/mcp-4-REQUIREMENTS.md), [audit](milestones/mcp-4-MILESTONE-AUDIT.md).
- **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221); [archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md)
- **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). The private-repository credential challenge deferred at closeout passed on 2026-09-30
- **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205); [archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md)
- **test-backlog** — completed 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md)
- **refine-unit-tests** — completed 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — completed 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)

Earlier milestones remain in [MILESTONES.md](MILESTONES.md). json-output's
phase details are in [its roadmap archive](milestones/json-output-ROADMAP.md),
and its phase records are under [json-output-phases](milestones/json-output-phases/).

## Phases

### In progress marketplace-features -- Marketplace Behavioral Tests

**Milestone goal:** A cucumber suite drives every `/claude:plugin marketplace`
lifecycle command through a real headless Pi, against local stand-ins for every
source kind, so a regression in marketplace behavior fails a scenario named
after it.

#### Source-kind strategy

Source kinds: **dir** (local directory), **file** (direct `marketplace.json`
path), **url** (https git URL on the loopback stand-in), and **gh**
(`owner/repo` or `https://github.com/...` through the override).

- A behavior that applies to several source kinds is one Scenario Outline with
  kind-neutral steps ("the marketplace X is published as a `<source kind>`
  source", "the user adds the marketplace X ..."). Steps resolve the kind to
  the real source string, and result tables reference it through a `<source>`
  token.
- Each such Outline has an untagged `Examples:` block for the local kinds (dir
  and file), an `@url` block, and an `@github` block. The verb phase writes all
  three blocks, and the requirement maps to that verb phase.
- `cucumber.json` excludes both tags (`tags: "not @url and not @github"`) until
  the kind phase lands. Each kind phase removes only its own tag from that
  expression, which turns on every row of that kind at once, with no
  feature-file edits.
- Kind-only behaviors (401, 404, 5xx, dropped connections, empty request logs,
  refused forms that reach no host, source spellings and refs, git re-add) live
  in feature files the kind phase owns.
- Verb phases own disjoint files: `features/marketplace/<verb>.feature` and
  `features/step_definitions/marketplace/<verb>.steps.ts`. Shared steps,
  fixtures, and support code belong to Phase 1; a verb step module defines only
  steps no other verb uses.
- Whichever of a verb phase and a kind phase lands second keeps the other's
  rows green. The `npm run check` merge gate enforces this.
- The last phase asserts that no tag exclusion remains.

- [x] **Phase 1: Suite Foundation** — The payload driver, exact-token comparison, the shared kind-neutral steps and local fixtures, the tag mechanism, and the unused-step gate that every other suite phase builds on (completed 2026-10-15)
- [x] **Phase 2: GitHub Clone-Base Override** — `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` sends every GitHub clone, fetch, origin match, and auth lookup to one configured base; unset, nothing changes (completed 2026-10-16)
- [x] **Phase 3: Marketplace Add** — `marketplace add` scenarios, with dir, file, `@url`, and `@github` rows for every multi-kind add behavior (completed 2026-10-16)
- [x] **Phase 3.1: Local Declaration Leak Fix** (INSERTED) — A marketplace added with `--local` stays out of `claude-plugins.json` across a reload, written test-first (completed 2026-10-16)
- [x] **Phase 3.2: Marketplace Layer Partition** (INSERTED) — The same marketplace may live in both layers, and named marketplace mutations change only their own layer (completed 2026-10-17)
- [x] **Phase 3.3: Plugin Layer Partition** (INSERTED) — Named plugin mutations act on their own layer, a plugin may be declared in both layers and is installed once, and a plugin's marketplace is declared in the same layer (completed 2026-10-17)
- [x] **Phase 3.4: Scope and Layer Terminology** (INSERTED) — Messages, reason tokens, docs, and code use scope, base/local layer, and config consistently (completed 2026-10-18)
- [x] **Phase 4: Marketplace Remove and List** — `remove`/`rm` with the plugin cascade, and `list`/`ls` across both scopes (completed 2026-10-18)
- [x] **Phase 5: Marketplace Info** — `info` source details for every kind, scope fan-out, not-added forms, and a broken manifest (completed 2026-10-18)
- [x] **Phase 6: Marketplace Update and C-10 Fix** — Single and bare `update`, with and without autoupdate, path-source failures, and the C-10 fix written test-first (completed 2026-10-19)
- [x] **Phase 7: Marketplace Autoupdate** — `autoupdate` and `noautoupdate`, by name and for all marketplaces, persisting across sessions (completed 2026-10-20)
- [x] **Phase 8: Marketplace Help and Usage Errors** — `marketplace help` and every usage rejection across the marketplace verbs (completed 2026-10-20)
- [x] **Phase 9: URL Source Kind and HTTPS Git Stand-In** — A loopback HTTPS git stand-in, url-only failure and no-request scenarios, and the removal of `@url` from the exclusion (completed 2026-10-21)
- [x] **Phase 10: GitHub Source Kind and Suite Close** — GitHub rows run through the override, 401 is covered on both git kinds, and the suite closes with no tag excluded (completed 2026-10-21)

#### Parallelism

```text
W0  Phase 1 (Suite Foundation)        Phase 2 (GitHub override; needs nothing)
W1  Phase 3  Phase 4  Phase 5  Phase 6  Phase 7  Phase 8  Phase 9   (each needs Phase 1 only)
W2  Phase 10 (needs Phases 1-9)
```

Phases 3.1, 3.2, and 3.3 were inserted after Phase 3 and run in that order:
3.1 stops the `--local` leaks, then 3.2 and 3.3 partition marketplace and
plugin mutations between a scope's shared and local layers (D-MF-03). Their
rules are what the later verb phases pin.

Phase 2 touches nothing under `features/` and can run from day one; only
Phase 10 waits for it. The seven W1 phases share no file, so they can run as
parallel agents once Phase 1 lands.

**Milestone invariants.** Each phase leaves `npm run check` green, and `check`
runs `npm run test:cucumber`. No scenario reaches the public network, a real
account, Device Flow, or the developer's home directory or git config. `Then`
steps observe the command payloads, a follow-up `list` or `info`, user-owned
config files, and the stand-in request log, never `state.json` or clone
directories. Where code and docs disagree (C-1 to C-13 in
`research/FEATURES.md`), scenarios pin the code. `autoupdate <name>` without
`--scope` (it changes both scopes) and the missing credential hint on `add` are
pinned as they are, not changed.

## Phase Details

### Phase 1: Suite Foundation

**Goal:** Every later suite phase can write marketplace scenarios without touching shared code: a driver that returns and validates every payload, exact-token comparison, kind-neutral publishing, adding, result-table, and config steps, the dir and file fixtures, the `@url`/`@github` exclusion, and a gate against unused steps.
**Depends on:** Nothing (first phase)
**Requirements:** DRV-01, DRV-02, DRV-04
**Research flag:** yes. The dry-run usage check runs under the `cucumber.json` tag expression, so a step used only by excluded `@url` or `@github` rows can read as unused; settle how the gate treats excluded rows. Fix the step-text conventions that keep two parallel verb step modules from defining the same step.
**Success Criteria** (what must be TRUE):

1. A marketplace scenario receives every payload its command emits, each validated against the published notification schema, and fails on a wrong payload kind, an extra payload, or a missing one. The driver covers `cascade`, `marketplace-info`, `marketplace-info-cascade`, `marketplace-not-added`, `usage-error`, `usage-info`, `plugin-info`, and one payload per marketplace from a bare `update`.
2. Sandbox paths appear in scenarios as exact tokens, substituted in both directions, and `lastUpdatedAt` is checked within a time window rather than hidden. The stand-in origin token joins the same mechanism in Phase 9.
3. Kind-neutral steps publish a marketplace as a dir or file source, add it, and compare result tables through `{home}`-style tokens; `url` and `github` resolve once their kind phase lands. Config steps read the user-owned `claude-plugins.json` and `claude-plugins.local.json` (D-07: read only until a requirement needs a write). Each shared step has its first use in a real seed scenario in the verb feature file it belongs to (D-06), not in a smoke feature.
4. `cucumber.json` runs `not @url and not @github`, so an Outline with untagged, `@url`, and `@github` Examples blocks runs only its local rows. The cucumber skill rules document the multi-kind Outline pattern, the exclusion, and which phase removes each tag.
5. `npm run check` fails on an unused, undefined, or ambiguous step: `npm run check:features` (in `check:static`) dry-runs every scenario through the cucumber API with the tag exclusion cleared, so excluded `@url` and `@github` rows count (D-09, D-10).

**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Tracer: payload driver and run tokens through one info scenario; kind row in every result table; not-added and usage kinds

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Feature gate in check:static (unused, undefined, ambiguous; layout and Gherkin rules), the @url/@github exclusion, and the features/ lint blocks

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Marketplace row and empty-result steps, publishing by source kind, broken manifests; LS-01, INFO-04, ADD-01, INFO-08 seeds

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-04-PLAN.md — Multi-payload envelope and rows steps, read-only config step, new-session setup; UPD-07, ADD-14, ADD-03 seeds

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-05-PLAN.md — Cucumber and local-verification skill docs; phase gate

### Phase 2: GitHub Clone-Base Override

**Goal:** With `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` set, every GitHub site (the clone URL, origin matching for leftover clones, marketplace update, and the auth host) uses the configured base through one seam, so the suite can serve GitHub sources locally. Unset, behavior does not change (D-MF-01).
**Depends on:** Nothing (production seam, independent of `features/`)
**Requirements:** GHB-01, GHB-02, GHB-03, GHB-04, GHB-05
**Research flag:** yes. Re-run the inventory of `github.com` literals (`rg 'github\.com' extensions/`), including the inline literals in `orchestrators/marketplace/update.ts` and `orchestrators/plugin/update-flow.ts`. Settle whether `canonicalCloneUrl` follows the override or only `originMatchesSource` accepts an origin under the base. Decide what `update` does when the override changes after `add` (the clone keeps its recorded origin): document it, or re-point the origin. The reader lives in `shared/`, never under `platform/git*`, because ESLint BLOCK F matches that substring.
**Success Criteria** (what must be TRUE):

1. With the variable set to an `https:` base, an `owner/repo` or `https://github.com/o/r[.git][#ref]` source clones from `<base>/<owner>/<repo>.git`, and leftover-clone recognition, `marketplace update`, and the auth host all use the same base. The auth host binds to the override's host and port, so Device Flow never starts against it. Each affected owner test has an override case.
2. A source-walk gate in `npm run check` fails when a new hard-coded `github.com` URL appears outside the seam.
3. A set but invalid value (not `https:`, or carrying userinfo, a query, or a fragment) fails the command with a typed error that names the variable.
4. With the variable unset, every GitHub-source operation behaves byte-identically to before, and `list`, `info`, and `claude-plugins.json` show GitHub sources in github.com terms whether the variable is set or not.
5. README (with its localized copies) and CHANGELOG document the variable as a divergence from Claude Code.

**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Tracer: a github.com clone goes to the base and keeps its canonical origin; the seam, the typed error, and the four rewritten platform calls with the fetched cause tail

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — One GitHub auth helper binds the override host with a stored credential (no Device Flow); add, update, and the plugin-update sync switched; an override case in each owner test

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — An invalid base fails marketplace add and update, install, enable, and import as a whole (D-08)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — An invalid base fails reinstall, fetch, info --fetch, and plugin update as a whole; bare info never reads it

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-05-PLAN.md — The github.com literal gate, the identity on the seam's constant, README and CHANGELOG divergence docs, and the phase gate

### Phase 3: Marketplace Add

**Goal:** `marketplace add` has scenarios for every add behavior, with multi-kind behaviors written once as Outlines whose dir and file rows pass now and whose `@url` and `@github` rows wait for their kind phase.
**Depends on:** Phase 1
**Requirements:** ADD-01, ADD-02, ADD-03, ADD-04, ADD-05, ADD-06, ADD-07, ADD-13, ADD-14
**Success Criteria** (what must be TRUE):

1. Adding a marketplace records it in the chosen scope under its manifest name, with dir, file, `@url`, and `@github` rows. An added marketplace appears in `marketplace list` and is still there in a new session, a name the scope already holds fails as `duplicate name`, and a malformed or schema-invalid manifest fails as `invalid manifest`, each with dir and `@url` rows. The local rows pass.
2. Without `--scope`, `add` uses the user scope; the same marketplace can be added to both scopes independently; and a path that does not exist fails as `source missing`, named by the source as typed.
3. `add --local` writes the declaration to `claude-plugins.local.json` and `remove --local` clears it, and `add ~/...` keeps the `~` form and resolves it against HOME.

**Plans:** 3/3 plans complete

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Tracer: a malformed or schema-invalid manifest fails add as invalid manifest (ADD-07); a path with no manifest fails as source missing, named as typed (ADD-06)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — A name the scope already holds fails as duplicate name, for the same source and for another directory (ADD-04); both scopes (ADD-05); the default user scope (ADD-02)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — add --local and remove --local declarations, with a new remove.feature (ADD-13); cucumber review of the ADD-01, ADD-03, and ADD-14 seeds; phase gate

### Phase 3.1: Local Declaration Leak Fix (INSERTED)

**Goal:** A marketplace added with `--local` never reaches the scope's `claude-plugins.json`, even when the next load runs the first-run config migration, so `remove --local` stays removed after a reload.
**Depends on:** Phase 3
**Requirements:** FIX-02, FIX-03
**Success Criteria** (what must be TRUE):

1. In a scope with no `claude-plugins.json`, a marketplace added with `--local` is still not declared in `claude-plugins.json` after a new session, and `claude-plugins.local.json` still declares it. The scenario failed on the code before the fix.
2. After `remove --local` and a new session, the marketplace stays removed: `marketplace list` omits it, and no config file declares it.
3. A scope whose records hold marketplaces added without `--local` still gets `claude-plugins.json` written from those records on its first load (MIG-01 unchanged for them).
4. A command naming a plugin (install, enable, disable, reinstall, update) is refused when it would write that plugin into `claude-plugins.json` while its marketplace is declared only in `claude-plugins.local.json`; the failed row suggests `--local`, and nothing is written. Forms naming no plugin write no shared declaration under a local-only marketplace (FIX-03).

**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 03.1-01-PLAN.md — Tracer: the first-run migration leaves out what the local file declares, test-first through a real Pi (SC1); remove --local stays removed (SC2); the pending mirror and the plugin-path proofs (FIX-02)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03.1-02-PLAN.md — The `marketplace declared locally` reason, the shared refusal rule, and the refused install, with a real-Pi scenario (FIX-03)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03.1-03-PLAN.md — Refused enable and disable; the update and reinstall write-back made hermetic per layer, so a --local plugin never reaches claude-plugins.json (FIX-03, D-08)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03.1-04-PLAN.md — Refused named update and reinstall before anything moves, the reinstall row's cause line, and the S5 file naming (FIX-03)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03.1-05-PLAN.md — The catalog row, the JSON output reason, the CHANGELOG bullet with the manual cleanup, the cucumber review, and the phase gate

### Phase 3.2: Marketplace Layer Partition (INSERTED)

**Goal:** Every marketplace mutation named on the command line is partitioned between a scope's shared layer (`claude-plugins.json`) and local layer (`claude-plugins.local.json`): the same marketplace may be declared in both layers, and a command without `--local` changes only shared entries while `--local` changes only local ones.
**Depends on:** Phase 3.1
**Requirements:** LAYER-01, LAYER-02, LAYER-03, LAYER-07
**Success Criteria** (what must be TRUE):

1. `marketplace add <src> --local` of a marketplace the shared layer already declares succeeds and declares it in the local layer as well; the reverse also succeeds (LAYER-01).
2. `marketplace remove`, `autoupdate`, and `noautoupdate` naming a marketplace act only on the target layer (shared by default, local with `--local`) and fail when that layer does not declare the marketplace, leaving the other layer untouched (LAYER-02).
3. Removing a marketplace from a layer uninstalls only the plugins that layer declares from it; plugins the other layer declares from the same marketplace stay installed (LAYER-03).
4. A project-scope install from a user-scope marketplace declares the marketplace in the project config and gives the project its own record and clone; removing the marketplace from the user scope leaves the project's plugins, list, info, and `marketplace update` working (LAYER-07, D-MF-04).

**Plans:** 9/9 plans complete

Plans:
**Wave 1**
- [x] 03.2-01-PLAN.md — Tracer: a marketplace one layer declares can be added to the other layer too, with no clone (LAYER-01); duplicate-name guards, the git-kind proof, convergence

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03.2-02-PLAN.md — Marketplace entries merge field by field, so a local declaration inherits the shared autoupdate (D-07); plugin entries stay wholesale; UAT-05 comments restated

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03.2-03-PLAN.md — Refusal vocabulary: the 3.1 class moves to shared errors, the `marketplace declared in shared config` reason is enrolled everywhere, both refusal rows are cataloged

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03.2-04-PLAN.md — The layer gate; a remove whose layer lacks the marketplace is refused; a remove from one layer keeps the other layer's plugins, the record, and the clone (LAYER-02, LAYER-03)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03.2-05-PLAN.md — Dependency retention on marketplace remove, the unreadable refusal, cross-marketplace retention, and the retained record in the list

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03.2-06-PLAN.md — Autoupdate and noautoupdate partitioned: named forms act on the target layer, nameless forms on every declaring layer or the local one with --local (LAYER-02)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 03.2-07-PLAN.md — Each scope owns its marketplace: a project install adds a user-scope marketplace to the project through the `marketplace add` code, and a failed install removes the clone it added (LAYER-07)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 03.2-08-PLAN.md — The integration proof that a user-scope remove keeps the project working; dependency marketplaces declared in the project; cross-scope scenarios (LAYER-07)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 03.2-09-PLAN.md — Catalog, CHANGELOG, READMEs, and dependency guide; cucumber review; the phase gate

### Phase 3.3: Plugin Layer Partition (INSERTED)

**Goal:** Every plugin mutation named on the command line acts on its target layer; the same plugin may be declared in both layers of a scope and is installed once; a plugin's marketplace is always declared in the plugin's own layer; and the two layers merge field by field.
**Depends on:** Phase 3.2
**Requirements:** LAYER-04, LAYER-05, LAYER-06, LAYER-08, LAYER-09
**Success Criteria** (what must be TRUE):

1. `plugin uninstall`, `enable`, `disable`, `update`, and `reinstall` naming a plugin act on the target layer (shared by default, local with `--local`) and fail with `plugin declared locally` or `plugin declared in shared config` when only the other layer declares the plugin; a command naming no plugin covers both layers (LAYER-04).
2. Installing a plugin into a layer while the other layer declares it adds the declaration, installs nothing, and reports `{already installed in [shared|local] layer}`; uninstalling it from a layer while the other layer declares it drops only that declaration, uninstalls nothing, and reports `{still installed in [shared|local] layer}` with the hint to repeat [with|without] `--local` (LAYER-05).
3. A plugin declared in a layer whose marketplace that layer does not declare is a configuration error for that layer on load (as CFG-03); `install --local` under a marketplace only the shared layer declares also declares the marketplace in the local layer; a flagless install under a local-only marketplace stays refused (LAYER-06, FIX-03).
4. A named uninstall of an installed plugin that no layer declares (a dependency) is refused listing the plugins in the target layer that need it, uninstalls nothing when only plugins of the other layer need it, and uninstalls it only when nothing needs it (LAYER-08).
5. Plugin entries merge field by field across the two layers, local winning on conflicts such as `enabled` (LAYER-09).

**Plans:** 10/10 plans complete

Plans:
**Wave 1**
- [x] 03.3-01-PLAN.md — Tracer: a named uninstall refuses when only the other layer declares the plugin, through a real Pi (LAYER-04)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03.3-02-PLAN.md — Plugin entries merge field by field, with the install's precedence read changed in the same commit (LAYER-09)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03.3-03-PLAN.md — Install, enable, and disable pick their layer by the flag; enable and disable refuse the other layer's plugin; a plugin's marketplace is declared in its own layer (LAYER-04, LAYER-06)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03.3-04-PLAN.md — The install and uninstall no-op rows for a plugin both layers declare, installed once; the field merge through a real Pi (LAYER-05, LAYER-09)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03.3-05-PLAN.md — A named uninstall of a dependency refuses, skips, or uninstalls by who needs it; a flagless enable or disable the local layer overrides is refused (LAYER-08, LAYER-04)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03.3-06-PLAN.md — Update and reinstall refuse a plugin only the other layer declares; with --local and no name they cover the local layer only (LAYER-04)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 03.3-07-PLAN.md — Update and reinstall write no declaration; the write-back family is deleted under a fallow dead-code check (LAYER-04, LAYER-06, LAYER-08)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 03.3-08-PLAN.md — The writing layer-file step; a layer that declares a plugin without its marketplace stops its scope's load; the import repair guard (LAYER-06)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 03.3-09-PLAN.md — Integration proof that layer refusals change nothing and update and reinstall declare nothing; the catalog rows (LAYER-04, LAYER-05, LAYER-06, LAYER-08)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 03.3-10-PLAN.md — CHANGELOG, READMEs, and guides; cucumber review; the phase gate

### Phase 3.4: Scope and Layer Terminology (INSERTED)

**Goal:** Every user-visible string, document, and code identifier uses the scope and layer terms defined in PROJECT.md: a scope is user or project, a layer is base or local, and a config is the file that holds a layer's declarations.
**Depends on:** Phase 3.3
**Requirements:** TERM-01
**Success Criteria** (what must be TRUE):

1. Reason tokens use the layer terms: `marketplace declared locally` becomes `marketplace in local layer only`, `marketplace declared in shared config` becomes `marketplace in base layer only`, `plugin declared locally` becomes `plugin in local layer only`, `plugin declared in shared config` becomes `plugin in base layer only`, and every other token that says "shared layer" says "base layer"; the catalog, JSON guide, schema, and pins change together, and the CHANGELOG's Unreleased entries use the new tokens (no rename list: the old tokens never shipped) (TERM-01).
2. Cause lines and message prose name the level as "the base layer" or "the local layer" and the file as "the base config" or "the local config" (for example "the local config (`claude-plugins.local.json`)" on first mention); README, README.es, the docs, and the CHANGELOG follow the same terms (TERM-01).
3. Code says `base` and `local` everywhere a layer is meant, never `shared`: `configJsonPath` becomes `baseConfigJsonPath` and `configLocalJsonPath` becomes `localConfigJsonPath`, error classes and identifiers follow, and comments match, with no behavior change. Carried from the Phase 3.3 review (IN-02): the flag-only layer selector and the uninstall seam that now loads both layers are renamed to match what they do (`selectDeclaringConfigWriteTarget` / `DeclaringConfigWriteTarget`, `UninstallTransaction.loadTargetConfig`) (TERM-01).
4. The `{unreadable}` cause for unreadable dependency declarations names the record without the parser's detail, for `uninstall`, `marketplace remove`, and the nameless `update --local` / `reinstall --local` (Phase 3.3 security note).

**Plans:** 10/10 plans complete

Plans:
**Wave 1**
- [x] 03.4-01-PLAN.md — Tracer: the plugin refusal pair renamed end to end (tokens, classes, cause lines, schema, catalog, scenarios, the existing CHANGELOG entry) (TERM-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03.4-02-PLAN.md — The marketplace refusal pair and the two base-layer no-op tokens; the uninstall's other layer is base or local (TERM-01)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03.4-03-PLAN.md — The remaining cause lines and descriptions name the base and local configs; the layer gap is base or local (TERM-01)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03.4-04-PLAN.md — Test-first: the `{unreadable}` dependency cause drops the text of a manifest that fails to load and keeps the fixed reasons, on every surface; the catalog, guide, and CHANGELOG follow (TERM-01, SC4)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03.4-05-PLAN.md — One scripted word-boundary replace: `baseConfigJsonPath` / `localConfigJsonPath`, then typecheck and the leftover grep, with the write-seam gate kept armed (TERM-01)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03.4-06-PLAN.md — IN-02: the flag-only layer loader, its result type, and both seams renamed; the other layer is `other`, not `sibling` (TERM-01)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 03.4-07-PLAN.md — Production identifiers and comments say base and local, the "sibling layer" comments included (TERM-01)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 03.4-08-PLAN.md — Test identifiers, helpers, titles, and comments say base and local, with unchanged test counts (TERM-01)

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 03.4-09-PLAN.md — Feature titles, descriptions, the step's layer word, and the cucumber rule say base and local; cucumber review (TERM-01)

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 03.4-10-PLAN.md — READMEs, guides, catalog prose, and CHANGELOG; whole-tree leftover gates; `npm run check` and the fallow audit against `1c3fc6c9` (TERM-01)

### Phase 4: Marketplace Remove and List

**Goal:** `marketplace remove`/`rm` and `marketplace list`/`ls` have scenarios for every scope and cascade behavior, with the multi-kind remove behavior written as an Outline.
**Depends on:** Phase 1
**Requirements:** RM-01, RM-02, RM-03, RM-04, RM-05, RM-06, RM-07, RM-08, LS-01, LS-02, LS-03, LS-04
**Success Criteria** (what must be TRUE):

1. Removing a marketplace with no installed plugins drops it with no reload needed, with dir and `@url` rows, and `rm` behaves as `remove`.
2. Removing a marketplace with installed plugins uninstalls each one with one `uninstalled` row and needs a reload. After it, a new session offers none of the plugin's skills, `plugin list` omits the plugin, and the marketplace stays removed.
3. A name the requested scope lacks fails as `marketplace not added`, naming the scope only when the other scope holds the name; a name neither scope holds, without `--scope`, fails with no scope; and a name both scopes hold is removed from the project scope only when `--scope` is absent.
4. `list` and `ls` show nothing when nothing is added, show every marketplace of both scopes project first with its autoupdate state and last-updated time, and narrow to one scope with `--scope`.

**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 04-01-PLAN.md — Record the approved removal divergence; cover clean removal, rm, scope precedence, and complete missing-target results
- [x] 04-03-PLAN.md — Cover complete list/ls inventories, scope filters, insertion order, and effective autoupdate details
- [x] 04-04-PLAN.md — Pin partial and failure-only cascade state, result grouping, and reload behavior through the existing JSON boundary

**Wave 2** *(blocked on 04-01 completion)*

- [x] 04-02-PLAN.md — Cover full cascades, clean new-session persistence, and all-blocker preflight refusal

### Phase 5: Marketplace Info

**Goal:** `marketplace info` has scenarios that show each source kind's details from one Outline, plus scope fan-out, not-added forms, and a manifest that became invalid.
**Depends on:** Phase 1
**Requirements:** INFO-01, INFO-02, INFO-03, INFO-04, INFO-05, INFO-06, INFO-08, INFO-09
**Success Criteria** (what must be TRUE):

1. One Outline shows each kind's source details: dir and file rows show the absolute path, autoupdate state, and description; an `@url` row shows the identity URL and ref; and an `@github` row shows owner, repo, and ref. The local rows pass.
2. A name both scopes hold, without `--scope`, shows one block per scope, project first; a name neither scope holds fails as `marketplace not added` with no scope; and `--scope` naming the scope that misses, while the other holds the name, says which scope missed.
3. Info on a marketplace whose manifest became invalid reports a failed `invalid manifest` row, and info shows the marketplaces a manifest allows cross-marketplace dependencies on.

**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — Prove and correct project-first mixed-scope info emission.
- [x] 05-02-PLAN.md — Cover source identities, descriptions and declaration-order allowances.
- [x] 05-03-PLAN.md — Complete healthy fan-out and both directed scope misses.

### Phase 6: Marketplace Update and C-10 Fix

**Goal:** `marketplace update` has scenarios for single and bare updates, with and without autoupdate, and for path-source failures, and `update` re-reads a manifest the user added from outside `.claude-plugin/` (C-10).
**Depends on:** Phase 1
**Requirements:** UPD-01, UPD-02, UPD-03, UPD-04, UPD-05, UPD-06, UPD-07, UPD-08, UPD-09, UPD-10, UPD-13, UPD-14, FIX-01
**Research flag:** yes. Measure the payload order of a bare `update`, including any trailing `mcp-config-notices` payload, before writing its scenario. A path-source manifest rewrite must change the file's size, or the mtime/size manifest cache hides it. Write the C-10 scenario first and watch it fail on the current code.
**Success Criteria** (what must be TRUE):

1. Updating a marketplace whose manifest did not change skips it as `up-to-date`, and one whose manifest changed reports `updated` with no plugin rows while autoupdate is off, each with dir, `@url`, and `@github` rows. The local rows pass.
2. With autoupdate off, installed plugins keep their version. With autoupdate on, the update moves installed plugins to the offered version and a new session offers it, an unchanged marketplace is skipped as `up-to-date`, a newly offered plugin is not installed, and a plugin the manifest dropped is skipped as `not in manifest` with warning severity.
3. A bare `update` refreshes every marketplace of both scopes with one result per marketplace, project first, and reports no marketplaces when none is added. Updating a name the scope lacks fails as `marketplace not added`, with and without `--scope`.
4. A path marketplace whose manifest became invalid fails with an `invalid manifest` row, and one whose directory vanished fails as `source missing`.
5. A marketplace added from a `marketplace.json` outside `.claude-plugin/` updates by re-reading that file, and `info` shows its path; the scenario failed on the code before the fix.

**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 06-01-PLAN.md — External-file red/green tracer, durable semantic baseline, and exact info source

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-02-PLAN.md — Semantic equality and invalid/missing-source recovery scenarios

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-03-PLAN.md — Installed-plugin version, membership, order, and failure cascades

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 06-04-PLAN.md — Bare-update order, adjacent notices, empty results, and named misses

### Phase 7: Marketplace Autoupdate

**Goal:** `marketplace autoupdate` and `noautoupdate` have scenarios for one marketplace and for all, with the new-marketplace default written as an Outline over every kind.
**Depends on:** Phase 1
**Requirements:** AU-01, AU-02, AU-03, AU-04, AU-05, AU-06, AU-07, AU-08, AU-09
**Success Criteria** (what must be TRUE):

1. `autoupdate` turns autoupdate on, and on a marketplace already on is skipped as `already autoupdate`; `noautoupdate` turns it off.
2. A newly added marketplace has autoupdate off, so `noautoupdate` is skipped as `already no autoupdate`, with dir, `@url`, and `@github` rows. The local rows pass.
3. The setting shows in `list` and `info` and survives a new session.
4. Without a name, the change applies to every marketplace of both scopes, or gives an empty result when none is added. A name neither scope holds fails as `marketplace not added`, and `autoupdate <name>` without `--scope` changes both scopes that hold the name.

**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 07-01-PLAN.md — Unscoped misses without a scope (D-08 red/green), scoped misses in both directions, and the empty result

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-02-PLAN.md — A local entry without a value inherits it (D-02 to D-05 red/green) and explicit-value pins

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-03-PLAN.md — Raw-text config steps, the broken-base scenario (D-05, D-09), and the docs and CHANGELOG

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-04-PLAN.md — Named, default, persistence, and both-scope scenarios, then the phase gate

### Phase 8: Marketplace Help and Usage Errors

**Goal:** `marketplace help` and every usage rejection across the marketplace verbs have scenarios that compare the whole `usage-info` or `usage-error` payload.
**Depends on:** Phase 1
**Requirements:** USE-01, USE-02, USE-03, USE-04, USE-05, USE-06, USE-07, USE-08
**Success Criteria** (what must be TRUE):

1. `marketplace help` and `help marketplace` show the marketplace usage, and `marketplace help` with an argument is rejected.
2. `marketplace` with no subcommand, or an unknown one, shows the usage with a reason, and `add`, `remove`, and `info` without their argument fail as `Missing required argument.`.
3. Surplus arguments, unknown flags (including `--local` on `list`, `info`, and `update`), a bad or missing `--scope` value in any position, and an explicitly empty optional argument (`update ""`, `autoupdate ""`) are each rejected.

**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 08-01-PLAN.md — Tracer: pin every marketplace rejection that passes today (missing, surplus, unknown flag, bad and missing --scope in every position)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — One signature table builds the marketplace help and every usage line; the help shows --local (D-01 red/green, D-02); help marketplace and the bare and unknown subcommand scenarios

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 08-03-PLAN.md — An empty argument names its field in the shared parser, on the marketplace verbs and uninstall, enable, and disable (D-05 red/green)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 08-04-PLAN.md — An empty install or info reference and an empty plugin list name are named (D-06 red/green); partly malformed references keep their message

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 08-05-PLAN.md — Empty update, fetch, and reinstall targets through one shared target parser (D-06 red/green); CHANGELOG, cucumber review, and the phase gate

### Phase 9: URL Source Kind and HTTPS Git Stand-In

**Goal:** A loopback HTTPS git stand-in serves bare marketplace repositories to Pi for the worker's run, url-only failure and no-request behaviors have scenarios, and removing `@url` from the exclusion turns on every url row the verb phases wrote.
**Depends on:** Phase 1
**Requirements:** HOST-01, HOST-02, HOST-03, HOST-04, DRV-03, ADD-08, ADD-09, ADD-10, ADD-12, RM-09, LS-05, INFO-07, UPD-11, SRC-01
**Research flag:** yes. The first plan is a walking skeleton: one end-to-end scenario that proves Pi's `--offline` RPC child lets extension HTTPS through and that the clone really reached the stand-in. Then check the CGI handling of `CONTENT_LENGTH`, chunked bodies, and `Git-Protocol`.
**Success Criteria** (what must be TRUE):

1. A scenario adds a url marketplace that Pi clones over HTTPS from the stand-in on `127.0.0.1`, with a certificate made at run time and trusted through `NODE_EXTRA_CA_CERTS` (TLS verification is never turned off), and the request log shows the clone. The stand-in starts before Pi, lives for the worker's run, and is reset before every scenario (repositories, arming, request log, CGI children) with the reset asserted empty; the cucumber skill rule allows this lifetime. Scenarios write the stand-in origin as an exact token.
2. Pi, the stand-in, and every fixture `git` run with `GIT_CONFIG_NOSYSTEM=1`, a sandbox global config, and no inherited `GIT_*` variables. A url repository armed to answer 401 fails `add` as `authentication required` with no stored credential, without reaching a credential helper outside the sandbox, and succeeds with a credential the scenario stores in the sandbox (the url half of ADD-11, which Phase 10 owns).
3. A repository armed for 404 fails `add` as `source missing`; one armed for 5xx fails it as `network error`, with a cause line that names the status and the URL, while a dropped connection fails it as `network unreachable`; and `update` against a host armed for 5xx or 404 fails as `network error`, with a cause line that names the status and the URL, while a dropped connection fails it as `network unreachable`.
4. A url source is cloned at exactly the URL typed, with no `.git` appended. A removed git marketplace can be added again from the same source. `list`, `info`, and `remove` of git marketplaces leave the request log exactly empty. Every refused source form fails as `unsupported source` and the stand-in receives no request. The re-add, empty-log, and refused GitHub-form scenarios carry `@github` Examples blocks for Phase 10.
5. The phase's last plan removes `@url` from the `cucumber.json` exclusion, and every `@url` row the verb phases wrote passes.
6. The `@url` rows that Phase 3.2 wrote for LAYER-07 run against the stand-in and pass: the cross-scope install Outline in `features/plugin/cross-scope-install.feature` and the three user-scope remove Outlines in `features/marketplace/remove.feature`. Each remove Outline's `@url` row is first shown failing, on a behavioral assertion, on code where a project install reuses the user-scope record instead of adding the marketplace (the install files planted from the parent of the commit that Phase 3.2's plan 07 SUMMARY names, or, if they no longer load, an equivalent local edit that is never committed), then passing on the current code. The install Outline's row guards the project declaration, which the older code also wrote, so it passes on both.

**Plans:** 8/8 plans complete

Plans:
**Wave 1**
- [x] 09-01-PLAN.md — Tracer: one url add cloned over HTTPS from the per-worker loopback git host, with the request log asserted and hermetic git environments; one task with a green checkpoint commit (HOST-01, HOST-02, HOST-04, DRV-03)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-02-PLAN.md — Unit cases for the CGI parser and the git environment builders (D-11, unit half); the cucumber rules for the git host's lifetime, log steps, and `{git host}` token (HOST-01, HOST-02, DRV-03)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 09-03-PLAN.md — Every url fixture operation, the verb-phase `@url` triage (D-13), the info ref and unreadable-skill row corrections (D-17, D-18), and the verbatim URL (SRC-01)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 09-04-PLAN.md — Per-repository arms; 404, dropped connection, and 401 with and without a sandbox credential on add; the by-hand isolation control (HOST-03, ADD-09, ADD-10, DRV-03)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 09-05-PLAN.md — Test-first: the 5xx add Outline gives a failed git add row its source as the JSON id (ADD-10, D-19); BACKLOG ROWID-01

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 09-06-PLAN.md — Test-first: a missing ref on a url add fails as source missing (D-16); url update failures (UPD-11)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 09-07-PLAN.md — Refused source forms reach no host (ADD-08); git re-add and the no-request list, info, and remove, each with an `@github` block (ADD-12, LS-05, INFO-07, RM-09)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 09-08-PLAN.md — Remove `@url` from the exclusion (SC5); the LAYER-07 remove rows red then green (SC6); the phase gate; the Phase 10 hand-off names the refused GitHub, bare-word, and `a/b/c` forms that run only in `@github` blocks

### Phase 10: GitHub Source Kind and Suite Close

**Goal:** GitHub sources run end to end against the stand-in through the override, 401 is covered with and without a stored credential on url and gh sources, and the suite closes with no tag excluded and a clean review.
**Depends on:** Phases 1, 2, 3, 4, 5, 6, 7, 8, 9
**Requirements:** ADD-11, UPD-12, SRC-02, SRC-03
**Research flag:** yes. Credential-helper isolation on macOS is LOW confidence. Measure CI duration and consider `parallel: 4` on CI.
**Success Criteria** (what must be TRUE):

1. With the override pointed at the stand-in, removing `@github` from the exclusion runs every GitHub row the verb phases and Phase 9 wrote (add, info with owner, repo, and ref, update, autoupdate, re-add, refused GitHub forms, and the empty request logs), and each passes. `list`, `info`, and `claude-plugins.json` show the sources in github.com terms.
2. `GitHub.com`, `www.github.com`, a `.git` suffix, and a trailing slash resolve to one source, and `owner/repo@ref` and `owner/repo#ref` clone that ref.
3. `add` against a GitHub repository that answers 401 fails as `authentication required` without a stored credential and succeeds with one the scenario stores in the sandbox, which completes ADD-11 with Phase 9's url rows. `update` of a url or GitHub marketplace whose host now answers 401 fails as `authentication required`, with a cause line naming `git credential approve` for that host.
4. The suite closes clean: a source-walk check fails if `cucumber.json` still excludes any tag; `cucumber-js --dry-run --format usage` reports no unused, undefined, or ambiguous step; the whole suite passes on Node 24 and Node 26; CI timing is recorded; a credential-isolation control run once by hand (a hostile `~/.gitconfig` and a planted system credential helper) changes no result; and a cucumber skill review of the suite finds no BLOCKER.
5. The `@github` rows that Phase 3.2 wrote for LAYER-07 run through the override and pass: the cross-scope install Outline in `features/plugin/cross-scope-install.feature` and the three user-scope remove Outlines in `features/marketplace/remove.feature`. Each remove Outline's `@github` row is first shown failing, on a behavioral assertion, on code where a project install reuses the user-scope record instead of adding the marketplace (the install files planted from the parent of the commit that Phase 3.2's plan 07 SUMMARY names, or, if they no longer load, an equivalent local edit that is never committed), then passing on the current code. The install Outline's row guards the project declaration, which the older code also wrote, so it passes on both.

**Plans:** 7/7 plans complete

Plans:
**Wave 1**
- [x] 10-01-PLAN.md — Tracer: one github add through the base override, end to end; the SRC-02 spelling Outline (D-01); the refused-source wording (IN-05); the `@github` triage

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md — The stand-in's EPIPE fix before any Node 24 run (D-14); the Phase 9 stand-in, hook, and doc findings (IN-01 to IN-04, IN-06 to IN-10)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-03-PLAN.md — A `stable` branch on every git publication (D-03, IN-11); `owner/repo#ref` test-first and refs proven by content (SRC-03, D-02, D-12); CHANGELOG and D-MF-07

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 10-04-PLAN.md — 401 on add and update for url and github (ADD-11, UPD-12, D-09 to D-11); the github update remedy line test-first (D-13)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 10-05-PLAN.md — Remove the `@github` exclusion (SC1, D-07); the LAYER-07 github remove rows red then green (SC5)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 10-06-PLAN.md — A cucumber skill review of the whole suite with no open BLOCKER (SC4)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 10-07-PLAN.md — Suite close: Node 24 and 26 runs (D-06), local timing (D-08), the hostile-config control, the Phase 9 ledger at `open: 0` (D-04), carry-overs (D-05), and the phase gate

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Suite Foundation | 5/5 | Complete    | 2026-10-15 |
| 2. GitHub Clone-Base Override | 5/5 | Complete    | 2026-10-16 |
| 3. Marketplace Add | 3/3 | Complete    | 2026-10-16 |
| 3.1. Local Declaration Leak Fix | 5/5 | Complete    | 2026-10-16 |
| 3.2. Marketplace Layer Partition | 9/9 | Complete    | 2026-10-17 |
| 3.3. Plugin Layer Partition | 10/10 | Complete    | 2026-10-17 |
| 3.4. Scope and Layer Terminology | 10/10 | Complete    | 2026-10-18 |
| 4. Marketplace Remove and List | 4/4 | Complete    | 2026-10-18 |
| 5. Marketplace Info | 3/3 | Complete    | 2026-10-18 |
| 6. Marketplace Update and C-10 Fix | 4/4 | Complete    | 2026-10-19 |
| 7. Marketplace Autoupdate | 4/4 | Complete    | 2026-10-20 |
| 8. Marketplace Help and Usage Errors | 5/5 | Complete    | 2026-10-20 |
| 9. URL Source Kind and HTTPS Git Stand-In | 8/8 | Complete    | 2026-10-21 |
| 10. GitHub Source Kind and Suite Close | 7/7 | Complete    | 2026-10-21 |

## Carried Forward

- `PRUNE-GUARD-MR-01` remains in [BACKLOG.md](BACKLOG.md). Marketplace removal
  can leave a dependent unsatisfied; the load-time check reports that state.
- `DEPADV-01` and `WOUT-01` remain in [BACKLOG.md](BACKLOG.md): Pi's shrinkwrap
  pins a nested `brace-expansion@5.0.9`, and workflow output is unobserved.
- Open user choice from json-output `09/` (D-03): the LLM tools return
  `isError: true`, which Pi 0.87.1 ignores; throwing a redacted Error instead
  would set Pi's error flag.
- `ROOTKEY-01`, carried from mcp-4, remains in [BACKLOG.md](BACKLOG.md): a root
  plugin name outside the dependency token alphabet gets a misleading
  dependency cause.
- `MKTPAR-01` is in [BACKLOG.md](BACKLOG.md): Claude Code's reserved official
  marketplace names, hosted `marketplace.json` URLs, and the `/plugin market`
  alias stay out of this milestone.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
