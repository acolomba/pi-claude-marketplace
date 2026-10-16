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
- [ ] **Phase 3.1: Local Declaration Leak Fix** (INSERTED) — A marketplace added with `--local` stays out of `claude-plugins.json` across a reload, written test-first
- [ ] **Phase 4: Marketplace Remove and List** — `remove`/`rm` with the plugin cascade, and `list`/`ls` across both scopes
- [ ] **Phase 5: Marketplace Info** — `info` source details for every kind, scope fan-out, not-added forms, and a broken manifest
- [ ] **Phase 6: Marketplace Update and C-10 Fix** — Single and bare `update`, with and without autoupdate, path-source failures, and the C-10 fix written test-first
- [ ] **Phase 7: Marketplace Autoupdate** — `autoupdate` and `noautoupdate`, by name and for all marketplaces, persisting across sessions
- [ ] **Phase 8: Marketplace Help and Usage Errors** — `marketplace help` and every usage rejection across the marketplace verbs
- [ ] **Phase 9: URL Source Kind and HTTPS Git Stand-In** — A loopback HTTPS git stand-in, url-only failure and no-request scenarios, and the removal of `@url` from the exclusion
- [ ] **Phase 10: GitHub Source Kind and Suite Close** — GitHub rows run through the override, 401 is covered on both git kinds, and the suite closes with no tag excluded

#### Parallelism

```text
W0  Phase 1 (Suite Foundation)        Phase 2 (GitHub override; needs nothing)
W1  Phase 3  Phase 4  Phase 5  Phase 6  Phase 7  Phase 8  Phase 9   (each needs Phase 1 only)
W2  Phase 10 (needs Phases 1-9)
```

Phase 3.1 was inserted after Phase 3 and needs it: its scenarios extend
Phase 3's `--local` files.

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
**Requirements:** FIX-02
**Success Criteria** (what must be TRUE):

1. In a scope with no `claude-plugins.json`, a marketplace added with `--local` is still not declared in `claude-plugins.json` after a new session, and `claude-plugins.local.json` still declares it. The scenario failed on the code before the fix.
2. After `remove --local` and a new session, the marketplace stays removed: `marketplace list` omits it, and no config file declares it.
3. A scope whose records hold marketplaces added without `--local` still gets `claude-plugins.json` written from those records on its first load (MIG-01 unchanged for them).

**Plans:** TBD

### Phase 4: Marketplace Remove and List

**Goal:** `marketplace remove`/`rm` and `marketplace list`/`ls` have scenarios for every scope and cascade behavior, with the multi-kind remove behavior written as an Outline.
**Depends on:** Phase 1
**Requirements:** RM-01, RM-02, RM-03, RM-04, RM-05, RM-06, RM-07, RM-08, LS-01, LS-02, LS-03, LS-04
**Success Criteria** (what must be TRUE):

1. Removing a marketplace with no installed plugins drops it with no reload needed, with dir and `@url` rows, and `rm` behaves as `remove`.
2. Removing a marketplace with installed plugins uninstalls each one with one `uninstalled` row and needs a reload. After it, a new session offers none of the plugin's skills, `plugin list` omits the plugin, and the marketplace stays removed.
3. A name the requested scope lacks fails as `marketplace not added`, naming the scope only when the other scope holds the name; a name neither scope holds, without `--scope`, fails with no scope; and a name both scopes hold is removed from the project scope only when `--scope` is absent.
4. `list` and `ls` show nothing when nothing is added, show every marketplace of both scopes project first with its autoupdate state and last-updated time, and narrow to one scope with `--scope`.

**Plans:** TBD

### Phase 5: Marketplace Info

**Goal:** `marketplace info` has scenarios that show each source kind's details from one Outline, plus scope fan-out, not-added forms, and a manifest that became invalid.
**Depends on:** Phase 1
**Requirements:** INFO-01, INFO-02, INFO-03, INFO-04, INFO-05, INFO-06, INFO-08, INFO-09
**Success Criteria** (what must be TRUE):

1. One Outline shows each kind's source details: dir and file rows show the absolute path, autoupdate state, and description; an `@url` row shows the identity URL and ref; and an `@github` row shows owner, repo, and ref. The local rows pass.
2. A name both scopes hold, without `--scope`, shows one block per scope, project first; a name neither scope holds fails as `marketplace not added` with no scope; and `--scope` naming the scope that misses, while the other holds the name, says which scope missed.
3. Info on a marketplace whose manifest became invalid reports a failed `invalid manifest` row, and info shows the marketplaces a manifest allows cross-marketplace dependencies on.

**Plans:** TBD

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

**Plans:** TBD

### Phase 7: Marketplace Autoupdate

**Goal:** `marketplace autoupdate` and `noautoupdate` have scenarios for one marketplace and for all, with the new-marketplace default written as an Outline over every kind.
**Depends on:** Phase 1
**Requirements:** AU-01, AU-02, AU-03, AU-04, AU-05, AU-06, AU-07, AU-08, AU-09
**Success Criteria** (what must be TRUE):

1. `autoupdate` turns autoupdate on, and on a marketplace already on is skipped as `already autoupdate`; `noautoupdate` turns it off.
2. A newly added marketplace has autoupdate off, so `noautoupdate` is skipped as `already no autoupdate`, with dir, `@url`, and `@github` rows. The local rows pass.
3. The setting shows in `list` and `info` and survives a new session.
4. Without a name, the change applies to every marketplace of both scopes, or gives an empty result when none is added. A name neither scope holds fails as `marketplace not added`, and `autoupdate <name>` without `--scope` changes both scopes that hold the name.

**Plans:** TBD

### Phase 8: Marketplace Help and Usage Errors

**Goal:** `marketplace help` and every usage rejection across the marketplace verbs have scenarios that compare the whole `usage-info` or `usage-error` payload.
**Depends on:** Phase 1
**Requirements:** USE-01, USE-02, USE-03, USE-04, USE-05, USE-06, USE-07, USE-08
**Success Criteria** (what must be TRUE):

1. `marketplace help` and `help marketplace` show the marketplace usage, and `marketplace help` with an argument is rejected.
2. `marketplace` with no subcommand, or an unknown one, shows the usage with a reason, and `add`, `remove`, and `info` without their argument fail as `Missing required argument.`.
3. Surplus arguments, unknown flags (including `--local` on `list`, `info`, and `update`), a bad or missing `--scope` value in any position, and an explicitly empty optional argument (`update ""`, `autoupdate ""`) are each rejected.

**Plans:** TBD

### Phase 9: URL Source Kind and HTTPS Git Stand-In

**Goal:** A loopback HTTPS git stand-in serves bare marketplace repositories to Pi for the worker's run, url-only failure and no-request behaviors have scenarios, and removing `@url` from the exclusion turns on every url row the verb phases wrote.
**Depends on:** Phase 1
**Requirements:** HOST-01, HOST-02, HOST-03, HOST-04, DRV-03, ADD-08, ADD-09, ADD-10, ADD-12, RM-09, LS-05, INFO-07, UPD-11, SRC-01
**Research flag:** yes. The first plan is a walking skeleton: one end-to-end scenario that proves Pi's `--offline` RPC child lets extension HTTPS through and that the clone really reached the stand-in. Then check the CGI handling of `CONTENT_LENGTH`, chunked bodies, and `Git-Protocol`.
**Success Criteria** (what must be TRUE):

1. A scenario adds a url marketplace that Pi clones over HTTPS from the stand-in on `127.0.0.1`, with a certificate made at run time and trusted through `NODE_EXTRA_CA_CERTS` (TLS verification is never turned off), and the request log shows the clone. The stand-in starts before Pi, lives for the worker's run, and is reset before every scenario (repositories, arming, request log, CGI children) with the reset asserted empty; the cucumber skill rule allows this lifetime. Scenarios write the stand-in origin as an exact token.
2. Pi, the stand-in, and every fixture `git` run with `GIT_CONFIG_NOSYSTEM=1`, a sandbox global config, and no inherited `GIT_*` variables. A url repository armed to answer 401 fails `add` as `authentication required` with no stored credential, without reaching a credential helper outside the sandbox, and succeeds with a credential the scenario stores in the sandbox (the url half of ADD-11, which Phase 10 owns).
3. A repository armed for 404 fails `add` as `source missing`; one armed for 5xx or a dropped connection fails it as `network unreachable`; and `update` against a host armed for 5xx, 404, or a dropped connection fails as `network unreachable`.
4. A url source is cloned at exactly the URL typed, with no `.git` appended. A removed git marketplace can be added again from the same source. `list`, `info`, and `remove` of git marketplaces leave the request log exactly empty. Every refused source form fails as `unsupported source` and the stand-in receives no request. The re-add, empty-log, and refused GitHub-form scenarios carry `@github` Examples blocks for Phase 10.
5. The phase's last plan removes `@url` from the `cucumber.json` exclusion, and every `@url` row the verb phases wrote passes.

**Plans:** TBD

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

**Plans:** TBD

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Suite Foundation | 5/5 | Complete    | 2026-10-15 |
| 2. GitHub Clone-Base Override | 5/5 | Complete    | 2026-10-16 |
| 3. Marketplace Add | 3/3 | Complete    | 2026-10-16 |
| 3.1. Local Declaration Leak Fix | 0/TBD | Not started | - |
| 4. Marketplace Remove and List | 0/TBD | Not started | - |
| 5. Marketplace Info | 0/TBD | Not started | - |
| 6. Marketplace Update and C-10 Fix | 0/TBD | Not started | - |
| 7. Marketplace Autoupdate | 0/TBD | Not started | - |
| 8. Marketplace Help and Usage Errors | 0/TBD | Not started | - |
| 9. URL Source Kind and HTTPS Git Stand-In | 0/TBD | Not started | - |
| 10. GitHub Source Kind and Suite Close | 0/TBD | Not started | - |

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
