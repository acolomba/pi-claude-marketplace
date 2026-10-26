# Phase 9: URL Source Kind and HTTPS Git Stand-In - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers the loopback HTTPS git stand-in and the url source kind for
the cucumber suite:

- `features/lib/` gains the stand-in (a `node:https` CGI wrapper around
  `git http-backend`, a run-time openssl certificate trusted through
  `NODE_EXTRA_CA_CERTS`, bound to `127.0.0.1`) and a bare-repository fixture.
  The stand-in starts before Pi, lives for the worker's run, and is reset
  before every scenario with the reset asserted empty (HOST-01, HOST-02). The
  cucumber skill rule is amended to allow that lifetime.
- Pi, the stand-in, and every fixture `git` run with a hermetic git
  environment (DRV-03).
- Scenarios can arm a repository to fail (HOST-03) and assert the exact
  request log (HOST-04).
- The url arms of `features/lib/published-marketplace.ts` replace their
  `noStandIn` throws, so the verb phases' `@url` rows run with no step change.
- Url-only scenarios in feature files this phase owns: refused source forms
  (ADD-08), 404 (ADD-09), 5xx and drop on add (ADD-10) and update (UPD-11),
  401 with and without a stored credential (the url half of ADD-11), git
  re-add (ADD-12), empty request logs for list, info, and remove (LS-05,
  INFO-07, RM-09), and the verbatim URL (SRC-01). Re-add, empty-log, and
  refused GitHub-form scenarios carry `@github` Examples blocks for Phase 10.
- The last plan removes `@url` from the `cucumber.json` exclusion, and every
  `@url` row passes, including the LAYER-07 rows (SC6).

The first plan is a walking skeleton: one end-to-end url add proving that
Pi's `--offline` RPC child lets extension HTTPS through and that the clone
reached the stand-in. Scouting shows `PI_OFFLINE` gates only Pi's model
runtime, package manager, version check, and tool downloads, but the
skeleton must prove it.

Out of scope: GitHub sources through the override, UPD-12, SRC-02, SRC-03,
and the suite close (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Request log (HOST-04)

- **D-01 (user):** Each request-log row shows method, path (with query), and
  the response status, for example
  `| GET | /acme/tools.git/info/refs?service=git-upload-pack | 200 |`. The
  path pins SC-01's exact typed URL (no `.git` appended), and the status shows
  which arm answered.
- **D-02 (user):** A log step compares only the requests of the last command.
  Each `When` starts a fresh window, so "add, then list" asserts that `list`
  made no request without restating the clone. The per-scenario reset still
  empties the whole log (HOST-02).
- **D-03 (user):** Log steps (a full table, or a "made no request" step)
  appear only in the url-owned feature files of this phase. The verb phases'
  `@url` rows share Outlines with dir and file rows and stay untouched.
- **D-04 (user):** No uncompared-log enforcement. Unlike `markRowsCompared`,
  a scenario does not fail when a command made requests that no log step
  compared; only explicit log steps assert.

### Failure arming (HOST-03)

- **D-05 (user):** A scenario arms one repository, not the whole host. Other
  repositories keep serving, so a bare update can show one failure beside a
  success.
- **D-06 (user):** The 401 arm accepts one credential: it answers 401 unless
  the request carries the user and password the scenario names. One arm
  proves both the no-credential failure and the stored-credential success.
- **D-07 (user):** The 5xx rows are an Outline over 500, 502, and 503, so a
  classifier keyed on one status fails. The cause line names each status and
  the URL.
- **D-08 (user):** A dropped connection drops on the first request: the
  socket is destroyed on the `info/refs` GET, which Pi's errno ladder
  (`ECONNRESET`) classifies as `network unreachable`.

### Credential and git isolation (DRV-03, ADD-11 url half)

- **D-09 (user):** The credential `Given` writes the sandbox files directly:
  a `.gitconfig` naming the `store` helper and a `.git-credentials` line for
  the stand-in origin. No git process runs in the step.
- **D-10 (user):** Pi's `GIT_CONFIG_GLOBAL` points at the sandbox
  `HOME/.gitconfig`, with `GIT_CONFIG_NOSYSTEM=1` and no inherited `GIT_*`.
  `Before()` empties HOME, so no helper survives a scenario; the file is
  absent unless a credential `Given` writes it.
- **D-11 (user):** Isolation is proven by a paired unit test that the env
  builders emit no inherited `GIT_*` and set `GIT_CONFIG_NOSYSTEM`, plus a
  by-hand control run once (a planted system or global credential helper
  outside the sandbox changes no result) recorded in the plan SUMMARY. No
  committed negative control (CONVENTIONS).
- **D-12 (user):** The stand-in's `git http-backend` and the fixture `git`
  runs use their own scratch HOME with `GIT_CONFIG_GLOBAL=/dev/null`, separate
  from Pi's sandbox HOME, so a scenario's credential config cannot change how
  the server behaves.

### Failing `@url` rows

- **D-13 (user):** A verb-phase `@url` row that fails against the stand-in is
  triaged. A product bug is fixed test-first in this phase (the failing row is
  the RED evidence, as in Phases 6 to 8), with paired unit tests and a
  CHANGELOG line. A wrong row is corrected. A fix that changes user-visible
  behavior beyond the requirement wording, or touches upstream parity, stops
  for the user's decision.
- **D-14 (user):** Until the last plan, plans run the `@url` rows by hand to
  triage. `cucumber.json` keeps the exclusion until the last plan, so every
  commit stays green. Correction from research: `--tags @url` on the CLI is
  ANDed with the profile's exclusion and runs 0 scenarios, so the triage run
  uses a scratch config with `"tags": "@url"` passed through `-c` (see
  09-RESEARCH.md for the exact command).
- **D-15 (user):** The LAYER-07 remove Outlines' red-then-green proof (SC6)
  plants the old install files from the parent of the commit Phase 3.2's plan
  07 SUMMARY names (or an equivalent local edit), runs the `@url` rows, saves
  the result as a `*-RED.json` in the phase directory as Phase 7 did,
  restores, and runs green. The plant is never committed.

### Decisions after research

- **D-16 (user):** A url add whose `#ref` does not exist emits
  `internal-error` "Command failed unexpectedly." today. Fix it test-first in
  this phase: a scenario fails first, then the failure becomes a typed result
  (research and planning pick the reason token, likely `source missing`
  naming the ref; if no existing token fits, stop for the user), with paired
  unit tests and a CHANGELOG line.
- **D-17:** The `info.feature` url row types a ref the bare repository has
  (`#main` instead of `#stable`), or the fixture publishes a `stable` ref;
  the planner picks one. The row stays a ref-carrying source.
- **D-18 (user):** The unreadable-skill-file update Outline
  (`features/marketplace/update.feature`, about line 885) is a local
  filesystem behavior: git cannot index a mode-000 file. Drop its `@url` and
  `@github` Examples blocks and keep the rule of three variants by turning it
  into a local-only scenario form that still has three or more variants, or
  into separate scenarios.
- **D-19 (user):** A failed url add's child row id reads `<url>@<url>`
  (03.2 review IN-04). Fix it in this phase, test-first: the scenario fails
  on today's id, then passes on the corrected one. Research or planning
  changes the JSON payload of failed git adds, so it gets a CHANGELOG line
  and updates any catalog entry or unit test that pins the old id. —
  **Reversibility:** costly — it changes the published payload's row id.
  - **Scope (user, after pattern mapping):** only the child row of a failed
    git (url) add. The same `<name>@<name>` id on other marketplace-level
    failure rows (`tools@tools`, from `marketplaceFailureRows`, pinned in
    remove, update, info, and file-source-update scenarios; 03.2 review IN-04,
    WINDOWS #98) stays pinned in this phase and is filed to BACKLOG.
  - **Shape (user):** the id is bare, with no `@`: the row names no plugin. For
    a failed add it is the source as typed (the row's name), for example
    `id: https://{git host}/acme/tools.git`. The fix must not change the id of
    plugin rows or of the other marketplace-level failure rows.

### Pinned as they are (carried forward, not re-asked)

- Tokens use braces; the stand-in origin is `{git host}` (Phase 1 D-03), as
  the existing `@url` rows write `https://{git host}/acme/tools.git`.
- `127.0.0.1` everywhere, HTTPS only, `NODE_TLS_REJECT_UNAUTHORIZED` never
  set. The certificate is made per worker at run time and never committed.
- Pi's env stays an allowlist built from scratch; `startRpcPi` gains a typed
  extra-env input and never spreads `process.env`.
- `Then` steps observe payloads, follow-up `list`/`info`, user-owned config
  files, and the request log; never `state.json` or clone directories.
- The missing credential hint on `add` is pinned as it is (milestone
  invariant).

### Claude's Discretion

- Exact step wording, feature-file names for the url-only behaviors, the
  module split under `features/lib/` (named for the kind, per layout.md), and
  the plan split.
- The CGI details the research flag names: `CONTENT_LENGTH`, chunked bodies,
  `Git-Protocol` → `GIT_PROTOCOL`, and a unit-tested CGI header parser.
- Which refused source forms form the ADD-08 Outline rows, as long as every
  form REQUIREMENTS.md lists is covered and each row asserts no request.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` — Phase 9 goal, success criteria 1-6, research flag; source-kind strategy and milestone invariants
- `.planning/REQUIREMENTS.md` — HOST-01..04, DRV-03, ADD-08..12, RM-09, LS-05, INFO-07, UPD-11, SRC-01
- `.planning/PROJECT.md` — current milestone key context (the 2026-10-15 CGI spike), NFR-5 network policy, upstream-parity rule

### Research
- `.planning/research/SUMMARY.md` — stand-in lifetime, certificate command, Pi and CGI env, pitfalls 1, 3, 5
- `.planning/research/STACK.md` — openssl and `git http-backend` details
- `.planning/research/ARCHITECTURE.md` — run lifecycle, components, what a `Then` may observe
- `.planning/research/PITFALLS.md` — credential-helper leaks, wrong-reason passes, CGI edge cases
- `.planning/research/FEATURES.md` — MF-* candidates, C-13 (update 404 classification)

### Prior phase context
- `.planning/phases/01-suite-foundation/01-CONTEXT.md` — D-03 tokens, D-09 usage gate over excluded rows
- `.planning/phases/03.2-marketplace-layer-partition/` — plan 07 SUMMARY names the commit for the SC6 plant
- `.planning/phases/07-marketplace-autoupdate/07-CONTEXT.md` — RED evidence convention

### Cucumber rules
- `.agents/skills/cucumber/SKILL.md` and `.agents/skills/cucumber/rules/{layout,features,steps,world-and-stand-ins}.md` — the slow-process exception that HOST-02 amends, Outline/tag rules, token rules

### Code
- `tests/e2e/_rpc.ts` — `childEnvironment`, `startRpcPi` (gains extra env)
- `features/support/pi-process.ts`, `features/lib/pi-process.ts` — run lifecycle, `Before()` reset
- `features/lib/published-marketplace.ts` — url arms to implement
- `features/lib/run-tokens.ts` — add `{git host}`
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` — 401/404/5xx/errno classification and the `{status} on {url}` cause frame
- `extensions/pi-claude-marketplace/platform/git.ts`, `platform/git-credential.ts` — transport and `git credential fill`
- `extensions/pi-claude-marketplace/domain/source.ts` — refused source forms

### Upstream compatibility evidence
- **Question:** does this phase touch a Claude Code contract? No: it is test infrastructure plus url-kind scenarios pinning Pi's existing classification. No upstream position applies; any product fix under D-13 that touches parity stops for the user.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/published-marketplace.ts`: dispatches every operation on source kind; the url arms throw `noStandIn` today and become the integration point.
- `features/support/source-kind.ts`: the `source kind` parameter already accepts `url`.
- `tests/e2e/_rpc.ts`: allowlist env (`HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH`) and `--offline`.
- `tests/live-uat/openai-stub-server.mjs`: an existing loopback stub for reference.

### Established Patterns
- One Pi per worker held as the run's module state; `Before()` replaces a busy Pi, empties the sandbox, and asserts an empty list.
- 56 `@url`/`@github` tagged Examples blocks across `add`, `info`, `remove`, `autoupdate`, `update`, and `plugin/cross-scope-install` feature files.
- `add` maps 404/410 to `source missing` and other statuses to `network error`; `update` adds a `{status} on {url}` cause frame.

### Integration Points
- `cucumber.json` `tags` (drop `not @url` in the last plan).
- `PiRun` gains the git host; a replaced Pi gets the same env.
- `.agents/skills/cucumber/rules/` amendment for the stand-in lifetime.

</code_context>

<specifics>
## Specific Ideas

- Walking skeleton first: one url add whose request log shows the clone.
- The SC6 install Outline row passes on both old and new code; only the three remove Outlines need the red proof.

</specifics>

<deferred>
## Deferred Ideas

- GitHub rows, UPD-12, SRC-02, SRC-03, and the suite close stay in Phase 10.

### Reviewed Todos (not folded)
- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md` §3: ports the skill to `acolomba/blueprint-typescript`, another repository.

</deferred>

---

*Phase: 09-url-source-kind-and-https-git-stand-in*
*Context gathered: 2026-10-20*
