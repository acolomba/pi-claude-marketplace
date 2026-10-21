# Phase 10: GitHub Source Kind and Suite Close - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 runs GitHub sources end to end against the Phase 9 loopback HTTPS
git stand-in through the `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` override
(Phase 2), covers 401 with and without a stored credential on url and github
sources, and closes the suite:

- The github arms of `features/lib/published-marketplace.ts` replace their
  `noStandIn` throws; Pi gets the override pointed at the stand-in; `@github`
  leaves the `cucumber.json` exclusion and every `@github` row the verb phases
  and Phase 9 wrote passes (SC1). `list`, `info`, and `claude-plugins.json`
  show github sources in github.com terms.
- SRC-02 spellings and SRC-03 refs (SC2).
- ADD-11 (github half; url half landed in Phase 9) and UPD-12 for url and
  github (SC3).
- Suite close (SC4, narrowed by D-07): Node 24 and Node 26 runs, CI timing,
  the hostile-config credential-isolation control run once by hand, and a
  cucumber skill review with no BLOCKER.
- The LAYER-07 `@github` rows (SC5): the three user-scope remove Outlines'
  `@github` rows shown RED on the old behavior, then GREEN.
- The 11 open Phase 9 info findings are fixed (D-04).

Requirements: ADD-11, UPD-12, SRC-02, SRC-03.

</domain>

<decisions>
## Implementation Decisions

### Spelling and ref proof (SRC-02, SRC-03)

- **D-01 (user):** SRC-02 is an Outline with one row per spelling
  (`GitHub.com`, `www.github.com`, a `.git` suffix, a trailing slash, plus the
  plain form). Each row proves the add cloned the same repository path on the
  git host (the request log shows `/acme/tools.git/...`) and that `info`
  shows owner `acme` and repo `tools`. The `claude-plugins.json` declaration
  is pinned to whatever the code stores; research reads it.
- **D-02 (user):** SRC-03 proves the ref by content: the fixture publishes a
  `stable` branch whose manifest differs from `main` (for example another
  description or plugin list). `owner/repo@stable` and `owner/repo#stable`
  scenarios assert that content and the `info` ref, so an implementation that
  clones `main` fails.
- **D-03:** The same ref-capable fixture lets the info Outline's git rows type
  a ref that differs from the default branch, which closes Phase 9 IN-11.

### Phase 9 info findings

- **D-04 (user):** Fix all 11 open Phase 9 info findings in this phase
  (`.planning/phases/09-url-source-kind-and-https-git-stand-in/09-REVIEW.md`,
  ledger `09-REVIEW-DISPOSITION.md`): IN-01 (parser negative case accepts any
  `Error`), IN-02 (CHANGELOG bullets and length), IN-03 (`drop` arm doc),
  IN-04 (keep-alive comment), IN-05 (two refused-form rows whose no-request
  check cannot fail, and the request-log step used outside a git-kind file),
  IN-06 (arm matches raw path while CGI serves the decoded path), IN-07
  (`BeforeAll`/`AfterAll` partial failure leaks the git host), IN-08 (`id`
  doc wording), IN-09 (`answerServerError` logs 500 for a dropped
  connection), IN-10 (no test drives the host's 500 path), IN-11 (D-03).
  The Phase 9 disposition ledger ends at `open: 0`.
- **D-05 (user):** BACKLOG ROWID-01 (`<mp>@<mp>` row ids) and WINDOWS #100
  (catalog 401 shape) stay out of this phase and are listed as known
  carry-overs in the suite close.

### Suite-close checks

- **D-06 (user):** "Passes on Node 24 and Node 26" is proven by local runs
  of the whole cucumber suite under both versions (for example a scratch
  `npx -p node@24`), with versions and results recorded in the SUMMARY. CI
  keeps its single Node 24 job (ci.yml D-01).
- **D-07 (user):** No "no tag excluded in `cucumber.json`" source-walk check.
  Removing `@github` from the exclusion is the close; ROADMAP SC4's
  source-walk item is dropped.
- **D-08 (user):** CI timing is measured at PR time: record local timing in
  this phase, read the real duration from the PR's behavioral-tests job at
  milestone close, and change `parallel` only if the job nears its timeout.
  Nothing is pushed during the phase.

### GitHub 401 coverage (ADD-11, UPD-12)

- **D-09 (user):** One Outline per behavior: add without a credential fails
  as `authentication required`; add with a stored credential succeeds; update
  of a marketplace whose host now answers 401 fails as `authentication
  required`. Each Outline has an `@url` block (the url row) and an `@github`
  block (`acme/tools` and `https://github.com/acme/tools` rows), meeting the
  three-variant rule. The Phase 9 url-only 401 add scenarios fold into these
  Outlines (moving into whichever feature file owns git-kind behaviors).
- **D-10 (user):** The update-401 scenario adds successfully, then arms the
  repository for 401, then runs `update`, and compares the whole cause chain,
  including the `git credential approve` pipeline naming `host={git host}`
  (the auth host binds to the override's host and port, Phase 2).

### Carried forward (not re-asked)

- Phase 9 D-01..D-19: request-log row shape and per-command window, log
  steps only in git-kind feature files, no uncompared-log enforcement,
  per-repository arming, the 401 arm accepting one Basic credential, 5xx
  over 500/502/503, drop on first request, credentials written directly into
  the sandbox, hermetic git envs, own scratch HOME for the host, and D-13
  triage of failing tagged rows (product bug → fix test-first; wrong row →
  correct; parity-affecting change → stop for the user).
- The `@url`/`@github` triage before the last plan uses a scratch cucumber
  config with `"tags": "@github"` passed by a path relative to the cwd
  (cucumber-js joins an absolute `-c` path onto the cwd; `--tags` on the CLI
  is ANDed with the profile and runs 0 scenarios).
- SC5's red proof reuses the Phase 9 SC6 recipe (`09-08-RED.json`): the
  `f78907bf` plant now loads but crashes in the install `Given`, so the
  equivalent local edit in `resolveTargetScopeMarketplace` is used, never
  committed.
- Phase 9's 09-08 hand-off: four refused GitHub forms
  (`https://github.com/acme/tools/tree/main`, `https://github.com/acme`, the
  bare word `tools`, `acme/tools/extra`) and the `git-source.feature`
  `@github` blocks run here.
- The hostile `~/.gitconfig` plus planted system credential helper control is
  run once by hand, never committed (CONVENTIONS), mirroring Phase 9 D-11.

### Post-research decisions (2026-10-21)

- **D-11 (user):** The add-401-without-credential behavior is split by kind,
  because url and github payloads differ by design (GHB-01; WINDOWS #100
  stays deferred). The url scenario stays a single scenario in the git-kind
  feature file; a github Outline has three rows (`acme/tools`,
  `https://github.com/acme/tools`, and a third spelling such as
  `https://github.com/acme/tools.git`). D-09 holds unchanged for
  add-with-credential and update-401.
- **D-12 (user):** Fix P-1 test-first: the shorthand `owner/repo#ref` parses
  the ref (as `owner/repo@ref` already does), restoring parity with Claude
  Code 2.1.296's `/^([^#@]+)(?:[#@](.+))?$/`. An empty ref (`acme/tools#`)
  is **allowed and treated as no ref** (user choice; upstream rejects it, so
  this is a recorded divergence). CHANGELOG line.
- **D-13 (user):** Fix P-2 test-first: a 401 on github `update` under the
  override carries the `no credential was obtained for {git host}; store one
  with: … git credential approve` cause, placed **before** the `fetched …`
  tail so the fetched URL stays the last link (GHB-01). With the override
  unset, nothing changes.
- **D-14:** The stand-in's HOST-EPIPE defect (`features/lib/https-git-host/cgi.ts`
  rejects on `EPIPE` from the CGI's stdin and answers 500, flaking url
  scenarios on Node 24) is fixed early in the phase, ahead of the Node 24 run.

### Claude's Discretion

- Exact step wording, feature-file placement for github-only behaviors, the
  fixture changes for a second ref, and the plan split.
- How the override value is threaded into Pi's environment (the Phase 9
  `RpcGitEnvironment` pattern is the analog).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` — Phase 10 goal and success criteria 1-5 (SC4 narrowed by D-07)
- `.planning/REQUIREMENTS.md` — ADD-11, UPD-12, SRC-02, SRC-03; GHB-01..05 (Phase 2)
- `.planning/PROJECT.md` — upstream-parity rule, the override divergence (D-MF-01)

### Prior phase context
- `.planning/phases/09-url-source-kind-and-https-git-stand-in/09-CONTEXT.md` — D-01..D-19
- `.planning/phases/09-url-source-kind-and-https-git-stand-in/09-RESEARCH.md` — measured payloads, triage command, SC6 recipe
- `.planning/phases/09-url-source-kind-and-https-git-stand-in/09-08-SUMMARY.md` — Phase 10 hand-off
- `.planning/phases/09-url-source-kind-and-https-git-stand-in/09-REVIEW.md` and `09-REVIEW-DISPOSITION.md` — the 11 info findings (D-04)
- `.planning/phases/02-github-clone-base-override/02-CONTEXT.md` — override seam, auth host binding

### Cucumber rules
- `.agents/skills/cucumber/SKILL.md` and `.agents/skills/cucumber/rules/{layout,features,steps,world-and-stand-ins}.md`

### Code
- `extensions/pi-claude-marketplace/shared/github-base-url.ts` — the override reader
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` — the `git credential approve` remedy line
- `features/lib/published-marketplace.ts` — github arms to implement
- `features/lib/https-git-host/server.ts`, `cgi.ts`, `features/lib/git-marketplace.ts`, `features/support/pi-process.ts`, `tests/e2e/_rpc.ts`
- `cucumber.json` — `"tags": "not @github"` today

### Upstream compatibility evidence
- **Question:** does this phase touch a Claude Code contract? Only through the existing override divergence (D-MF-01, documented in Phase 2); scenarios pin Pi's behavior. Any product fix found under D-13 that touches parity stops for the user.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Phase 9 stand-in, arming, request-log steps, credential step, and url fixture arms (`changePublication`, `pushGitRepository`).
- `tests/e2e/_rpc.ts` `RpcGitEnvironment` closed interface for adding the override variable.

### Established Patterns
- Tagged Examples blocks per kind; triage via a scratch config before the switch-on plan.
- RED evidence files (`*-RED.json`) for test-first fixes and red proofs.

### Integration Points
- `cucumber.json` tags (drop `not @github` in the last plan).
- `features/support/pi-process.ts` Pi environment (override set to the stand-in origin).

</code_context>

<specifics>
## Specific Ideas

- The github fixture shares the `/<owner>/<repo>.git` layout with url sources (milestone research).

</specifics>

<deferred>
## Deferred Ideas

- BACKLOG ROWID-01 and WINDOWS #100 (D-05).

### Reviewed Todos (not folded)
- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md` §3: another repository.

</deferred>

---

*Phase: 10-github-source-kind-and-suite-close*
*Context gathered: 2026-10-21*
