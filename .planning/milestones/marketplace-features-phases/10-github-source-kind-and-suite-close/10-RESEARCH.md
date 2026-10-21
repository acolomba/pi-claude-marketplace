# Phase 10: GitHub Source Kind and Suite Close - Research

**Researched:** 2026-10-21
**Domain:** cucumber behavioral tests (github source kind through the GitHub base override), two product fixes, stand-in hardening, suite close
**Confidence:** HIGH for everything measured in this session (stand-in runs, payloads, Node 24/26 runs, hostile-config control on Linux); MEDIUM for CI behavior; LOW for macOS credential isolation

## Summary

All measurements below come from a hermetic scratch copy of `HEAD` (`git archive HEAD` into the session scratchpad, `node_modules` symlinked). That copy has a 20-line change: the github arms of `features/lib/published-marketplace.ts` reuse the url arms with `source = acme/<directory>`, and Pi's environment gets `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL=https://<git host address>`. With that change, **38 of the 39 `@github` scenarios pass at once**. The one failure is `info.feature:44` (`acme/tools#main`). This repository was not edited.

The research found three product or stand-in defects that the planner must schedule. Two of them were not known before:

1. **`owner/repo#ref` does not parse as a ref (SRC-03 blocker).** `acme/tools#stable` parses as owner `acme`, repo `tools#stable`, no ref. The add then requests `/acme/tools` and fails as `source missing`. `acme/tools@stable` and `https://github.com/acme/tools#stable` already work. Claude Code 2.1.296 splits the shorthand on the first `#` or `@`. So fixing this restores parity.
2. **A github `update` answered 401 under the override has no `git credential approve` line (UPD-12 gh blocker).** The url arm has the line. The github arm ends with `fetched https://{git host}/acme/tools.git`.
3. **The https git host fails under Node 24 (SC4 blocker, and a CI risk today).** `runHttpBackend` rejects on `EPIPE` from the CGI's stdin, so the host answers 500. Current `HEAD` fails 1 to 2 url scenarios per run on Node 24.21.0, and CI runs Node 24. A trial fix that tolerates `EPIPE` gave 3 of 3 green runs of all 412 scenarios on Node 24.

There is also a **conflict in a locked decision**. D-09 puts "add without a credential fails" in one Outline with url and github rows. The two kinds give different payload shapes. A url 401 add gives a bare failed marketplace row. A github 401 add under the override gives a failed child row whose cause ends with the fetched URL (GHB-01, by design). One `Then` table cannot compare both.

**Primary recommendation:** Wire the override and the github fixture arms first, and fix the stand-in `EPIPE`. Then fix the two product defects test-first, each with its failing row as RED evidence. Only after that, switch on `@github` and close the suite. Ask the user about the D-09 shape conflict and about the two product fixes before planning locks them (see Open Questions).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Spelling and ref proof (SRC-02, SRC-03)

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

#### Phase 9 info findings

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

#### Suite-close checks

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

#### GitHub 401 coverage (ADD-11, UPD-12)

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

#### Carried forward (not re-asked)

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

### Claude's Discretion

- Exact step wording, feature-file placement for github-only behaviors, the
  fixture changes for a second ref, and the plan split.
- How the override value is threaded into Pi's environment (the Phase 9
  `RpcGitEnvironment` pattern is the analog).

### Deferred Ideas (OUT OF SCOPE)

- BACKLOG ROWID-01 and WINDOWS #100 (D-05).

#### Reviewed Todos (not folded)
- `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md` §3: another repository.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADD-11 | A clone answered with 401 and no stored credential fails as `authentication required`; with a stored credential in the sandbox, it succeeds (url, gh) | The measured github payloads (both rows) are under "Measured payloads: add 401". The success path needs no product change, and the request log is 401, 200, 200. The no-credential shape differs from url (Open Question 1). |
| UPD-12 | A git marketplace whose host now answers 401 fails as `authentication required`, with the cause line naming `git credential approve` for that host (url, gh) | The url arm passes today, and its whole chain is measured. The gh arm lacks the line (product fix P-2). With a trial fix, the chain is measured and passes. |
| SRC-02 | GitHub spellings (`GitHub.com`, `www.github.com`, a `.git` suffix, a trailing slash) resolve to one source | All 6 spellings were measured: the same request paths, the same `info` source, and a verbatim declaration. No product change is needed. |
| SRC-03 | `owner/repo@ref` and `owner/repo#ref` clone that ref | `@stable` and `https://github.com/o/r#stable` clone `stable` today (measured by content). `acme/tools#stable` fails (product fix P-1). The trial fix passes `source.test.ts` (161/161) and the info row. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Upstream parity is the default.** A divergence needs a recorded decision with an ID or a Pi capability gap. A finding that changes parity goes to the user as a question. P-1 restores parity, and the user should confirm it (Open Question 2).
- **Never commit to `main`. Never use `--no-verify`. Never rebase.** Commit through `.agents/skills/committing/SKILL.md`. `gsd-tools commit` runs `git commit --no-verify`, so do not use it here.
- **GSD gates run `npm run check`** on the combined tree after each wave, at the phase gate, and at the handoff. A passing hook (`check:commit`) is not a gate verdict. `npm run check` includes `test:cucumber`.
- **Every plan `SUMMARY.md` has a `## Threat Flags` section**, even when it says "None".
- **Product fixes need 100% direct coverage** for each source-test pair (`npm run test:coverage:direct:all`). `domain/source.ts` pairs with `tests/domain/source.test.ts`. `orchestrators/marketplace/update.ts` (or `shared.ts`) pairs with its test file.
- **Comments and test titles cite durable IDs** (D-NN, NFR-N, GHB-0N, SRC-0N), never phase, plan, or wave numbers.
- **Tests that touch user scope use `withHermeticHome`, or a temp `PI_CODING_AGENT_DIR`/`HOME`.** The cucumber run already sandboxes Pi.
- **No direct `process.stdout`/`stderr` in the extension. No new network module. No `github.com` literal** outside the seam without an `eslint-disable-next-line local/no-github-literal -- <reason>` (D-06 of Phase 2). This applies to `extensions/pi-claude-marketplace/**` only.
- **CHANGELOG:** one reader-facing bullet per PR, each of 40 words or fewer (changelog skill). IN-02 cites a 25-word sentence limit from the skill's rules. Read `.agents/skills/changelog/rules/entries.md` when you write.
- **Each product fix under D-13 gets** a paired unit test and a CHANGELOG line, and its failing row is the RED evidence.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Override value reaches Pi | Test driver (`tests/e2e/_rpc.ts` `RpcGitEnvironment`/`rpcChildEnvironment`) | Cucumber run state (`features/support/pi-process.ts`) | The allowlist environment is built only in `rpcChildEnvironment`. The run state fixes the value at `BeforeAll`, because the git host's port is known only then. |
| github fixture (publish, push, branch, remove) | `features/lib/published-marketplace.ts` + `features/lib/git-marketplace.ts` | `features/lib/https-git-host/server.ts` (repository layout) | The world records the kind, and the library dispatches on it. Steps do not change for a new kind (world-and-stand-ins.md). |
| Shorthand `#ref` parse (P-1) | Domain (`extensions/.../domain/source.ts` `parseShorthandSourceForm`) | — | All source parsing lives here. Persistence re-parses `raw` through the same funnel (ST-6). |
| Credential remedy line on github update (P-2) | Orchestrator (`orchestrators/marketplace/update.ts` github arm, or a `shared.ts` helper beside `refreshUrlClone`) | Auth seam (`orchestrators/auth-host.ts` `NO_STORED_CREDENTIAL_CAUSE`) | The url arm attaches the line in `marketplace/shared.ts::refreshUrlClone`. The github arm has no equivalent. |
| Stand-in robustness (EPIPE, IN-06, IN-09, IN-10) | `features/lib/https-git-host/{cgi,server}.ts` | `tests/architecture/https-git-host-cgi.test.ts` | Stand-in code is library code. Its unit cases live in `tests/architecture/` (unpaired). |
| Scenario text (SRC-02/03, ADD-11, UPD-12) | `features/marketplace/*.feature` | `features/step_definitions/marketplace/*.steps.ts` | The cucumber skill layout applies. |

## Standard Stack

No new package. Everything already exists in the repository.

| Library / tool | Version (measured) | Purpose |
|---|---|---|
| `@cucumber/cucumber` | 13.3.0 [VERIFIED: node_modules/@cucumber/cucumber/package.json] | runner, `--dry-run --format usage`, API dry run in `scripts/check-features.mjs` |
| `isomorphic-git` | 1.42.3 [VERIFIED: node_modules/isomorphic-git/package.json] | Pi's git transport (unchanged) |
| git | 2.55.0, `git-http-backend` at `/usr/libexec/git-core/git-http-backend` [VERIFIED: `git --version`, `git --exec-path`] | fixture commits and the CGI |
| OpenSSL | 4.0.3 local [VERIFIED: `openssl version`]. CI ubuntu-latest has 3.0.13 [CITED: 09-RESEARCH.md A1, not re-verified] | the stand-in's certificate |
| Node | 26.11.1 (default), 24.21.0 (cached in `~/.npm/_npx/1baf2842a96ca965`), 22.22.2 (`/usr/bin/node`) [VERIFIED: probes] | D-06 runs |

**Package Legitimacy Audit:** not applicable. The phase installs no package. `npx -p node@24.21.0` uses the existing npx cache with `--prefer-offline`. It is a runtime for a local check and is never added to `package.json`.

## Architecture Patterns

### System Architecture Diagram

```text
scenario Given "published as a github source"
   │
   ▼
published-marketplace.ts (kind dispatch) ──► git-marketplace.ts: work tree commit ──► bare repo
   │  source = "acme/<dir>"                                                    <git-host root>/repositories/acme/<dir>.git
   ▼
When "/claude:plugin marketplace add acme/tools ..."  (expandTokens)
   │
   ▼
Pi child (env allowlist: HOME, PI_CODING_AGENT_DIR, PI_OFFLINE, PATH,
          NODE_EXTRA_CA_CERTS, GIT_CONFIG_NOSYSTEM, GIT_CONFIG_GLOBAL,
          + PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL=https://127.0.0.1:<port>)
   │ parsePluginSource → github{owner,repo,ref?} → networkCloneUrl = https://github.com/acme/tools.git
   │ platform/git.ts gitHubWireUrl → https://127.0.0.1:<port>/acme/tools.git   (auth host = 127.0.0.1:<port>)
   ▼
HttpsGitHost (127.0.0.1, TLS) ──arm? (status | drop | credential)──► git http-backend CGI
   │ request log (method, path, status)                                   │
   ▼                                                                       ▼
Then steps: result fields / rows (tokens projected: {git host}, {home}),  claude-plugins.json, request log
```

### Recommended file placement

```text
features/marketplace/github-source.feature   # NEW: SRC-02 spellings Outline, SRC-03 ref Outline (github-only, so its own file)
features/marketplace/git-source.feature      # D-09/D-10 url+github Outlines (git-kind file, so log steps are allowed); the folded url 401 add rows
features/marketplace/url-source.feature      # loses the two 401 add scenarios that fold into git-source (D-09)
features/marketplace/info.feature            # git rows move to #stable (D-03/IN-11)
features/lib/git-marketplace.ts              # + a branch-publishing helper
features/lib/published-marketplace.ts        # github arms; + branch dispatch
features/support/pi-process.ts               # override in piEnvironment; IN-07
tests/e2e/_rpc.ts                            # RpcGitEnvironment + rpcChildEnvironment carry the override
tests/architecture/hermetic-git-environment.test.ts   # whole-object expectations updated
```

The feature title must equal `<function> <capability>` of its file name. For example, `features/marketplace/github-source.feature` has the title `Feature: Marketplace github source` [VERIFIED: scripts/check-features.mjs feature-title rule; layout.md].

### Pattern 1: Thread the override through the closed `RpcGitEnvironment`

`RpcGitEnvironment` today [VERIFIED: tests/e2e/_rpc.ts:49-53]:

```ts
export interface RpcGitEnvironment {
  readonly NODE_EXTRA_CA_CERTS: string;
  readonly GIT_CONFIG_NOSYSTEM: "1";
  readonly GIT_CONFIG_GLOBAL: string;
}
```

`rpcChildEnvironment` copies exactly these three keys when `git` is given [VERIFIED: tests/e2e/_rpc.ts:180-197]. `features/support/pi-process.ts:68-72` builds the value [VERIFIED]:

```ts
const piEnvironment = {
  NODE_EXTRA_CA_CERTS: gitHost.certificatePath,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: path.join(sandbox.home, ".gitconfig"),
} satisfies RpcGitEnvironment;
```

Add `readonly PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: string;` to the interface. Copy it in `rpcChildEnvironment`. Set it to `` `https://${gitHost.address}` `` in `piEnvironment`. `gitHost.address` is `127.0.0.1:${port}` [VERIFIED: features/lib/https-git-host/server.ts:265]. The replaced-Pi path (`Before`, `PiProcess.start(run.sandbox, run.piEnvironment)`) reuses the same object, so a restarted Pi gets the override too [VERIFIED: features/support/pi-process.ts:89-92]. Update both cases of `tests/architecture/hermetic-git-environment.test.ts` (around lines 71-110). Its expected objects are whole-object literals, and its title says "the three git keys". Also plant the variable in `inheritGitVariables`, to prove that an operator's own value is never inherited.

The override reader accepts only `https:` with no userinfo, query, or fragment. It strips trailing slashes, and the auth host is WHATWG `base.host` (host plus a non-default port) [VERIFIED: extensions/pi-claude-marketplace/shared/github-base-url.ts:36-71, `return { url: `${base.origin}${pathname}`, host: base.host };`]. `https://127.0.0.1:<port>` is valid, so the bound host is `127.0.0.1:<port>`, which the `{git host}` token projects exactly.

### Pattern 2: github fixture arms reuse the url arms

The stand-in serves `/acme/<dir>.git` with no prefix [VERIFIED: server.ts:32 `const OWNER = "acme";`, :296-303 `repositoryPath` → `path.join(this.repositories, OWNER, `${directory}.git`)`]. The wire URL of a github source is `https://github.com/acme/tools.git`, which the override rewrites to `https://127.0.0.1:<port>/acme/tools.git` (measured request paths below). So every github arm equals its url arm. Only `source` differs: `` `acme/${directory}` `` instead of `gitHost.repositoryUrl(directory)`. This change was trialled in the scratch tree, and the result was 38/39 `@github` passing. Arms to change [VERIFIED: features/lib/published-marketplace.ts:103-105 `noStandIn`, :125-126, :160-161, :216-217, :283-284, :345-346]: `changePublication`, `requireFreeRoot`, `publishMarketplaceIn`, `removePublishedSource`, and `publishUnreadableSkillFile`. The last one must throw "a git repository cannot hold a file nobody may read", as url does. Delete `noStandIn` once it has no caller, because fallow dead-code would flag it. Update the file headers of `published-marketplace.ts` and `git-marketplace.ts` ("The github kind lands with its stand-in", "the github kind will share it").

Prefer not to hard-code `acme` twice. Either export the owner from `server.ts`, or give `GitRepositoryHost` a method that returns the `owner/repo` shorthand. The planner decides.

### Pattern 3: A ref-capable fixture (D-02, D-03)

Measured in the scratch probe: after `publishGitRepository`, run `checkout -b stable`, write a different manifest, `add -A`, `commit`, `push origin stable`, then `checkout main`. This gives a `stable` branch that `acme/tools@stable` clones. `list --available` then showed the `stable` plugins (`demo 2.0.0`, `extra 1.0.0`) instead of main's `demo 1.0.0`. `info` showed `ref: stable`. `pushGitRepository` pushes only `main` [VERIFIED: features/lib/git-marketplace.ts:39-43 `await runGit(workTree, home, "push", "-q", "origin", "main");`]. So a later republish leaves `stable` alone, as long as the helper returns the work tree to `main`.

Two designs fit the step rules. Choose one:

- **(a) Explicit branch step, git kinds only** (recommended for SRC-03). For example: `Given the branch "stable" of the marketplace "tools" has the description "Stable tools"`. It is used only in `github-source.feature`, where every row is a git kind. The step fails for a path publication, as `publishUnreadableSkillFile` does for url.
- **(b) For the info Outline (D-03/IN-11).** Its Givens are shared with the dir and file rows. A git-only step cannot appear there unless every git publication also gets a `stable` branch. One way: make `pushGitRepository` push `main` and `main:stable`, so `stable` always tracks `main`, and a git-only step diverges `stable` afterwards as the last Given. Another way: drop the Outline's git rows to their own git-only scenario. Under (b) as described, the info Outline's description row ("Tools for formatting") must still hold at `#stable`, so `stable` must carry main's latest content. That is why it must track `main` on every push.

Use `description` as the distinguishing content. `marketplace info` returns `description` and `source.ref` in one payload, so one `When` proves both [VERIFIED: features/marketplace/info.feature:14-28 `the marketplace info result has these fields:` with `description` and `source ref` rows].

### Pattern 4: Running a tagged block before the switch-on

`cucumber.json` today [VERIFIED: cucumber.json]:

```json
{ "default": { "import": ["features/support/**/*.ts", "features/step_definitions/**/*.steps.ts"],
  "format": ["summary"], "order": "random", "tags": "not @github", "parallel": 8 } }
```

Before the switch-on plan, run the `@github` rows with a scratch config that has `"tags": "@github"`, passed by a path relative to the cwd. This was verified here: `npx cucumber-js -c ../../../../tmp/claude-1000/.../gh.json --dry-run` listed 39 scenarios. After the switch-on, plain `npm run test:cucumber -- --tags @github` works, because nothing is left to AND with.

### Anti-Patterns to Avoid

- **A shape-hiding step that would let one D-09 Outline span both 401-add shapes.** For example, a step that reads `reasons` from wherever they sit. It hides the real difference, and a wrong implementation could pass (the review's first question). Ask the user instead (Open Question 1).
- **A `Given` that silently does nothing for path kinds** (for example, "publishes a stable branch" for dir rows). Fail loudly, or keep the step out of shared Outlines.
- **Writing `\n` in a table cell when you mean the two characters backslash-n.** Gherkin turns `\n` in a cell into a newline. The cause line has literal `\n` sequences, so write `\\n`. Also escape the pipe before `git credential approve` as `\|`.
- **An Examples column named `user` or `token`** in an Outline whose cells hold `<user>` or `<token>` (the credential pipeline text). Gherkin would substitute them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| A second fake for github.com | A new server, path prefix, or virtual host | The Phase 9 `HttpsGitHost` through the override (`/acme/<repo>.git`) | It is the same layout, and the override is the product's own seam (D-MF-01). 38/39 rows passed with no new server. |
| Storing a credential in the sandbox | Running `git credential approve` | The existing step `the user has stored a credential for the git host with the user {string} and the password {string}` | That step writes `.gitconfig` plus `.git-credentials` keyed to `this.gitHost.address`, which equals the override auth host. Measured: the github add succeeds with it. |
| Red evidence for the remove rows | A new plant | The `09-08-RED.json` local edit in `resolveTargetScopeMarketplace` | Measured on the `@github` rows: 3 failed at `Then the result has these fields:`, and 3 passed. |
| An unused-step check | A new script | `npm run check:features`, plus `cucumber-js --dry-run --format usage` once the exclusion is gone | They are the same after the switch-on. Both reported no `UNUSED` in the scratch tree (412 scenarios). |

## Runtime State Inventory

Not a rename phase. The only runtime state is the run's own: the sandbox and the git host under `mkdtemp(tmpdir())`, rebuilt every run. None was found in any category. Verified by reading `features/support/pi-process.ts:56-120`, which creates and removes everything under one temporary root.

## Measured payloads (scratch probe, Node 26.11.1, override on, tokens projected)

The probe started `HttpsGitHost` and one Pi with the override in a scratchpad sandbox. Its HOME, agent directory, and cwd were all temporary. The real `~/.pi/agent` was never touched.

### SRC-02: every spelling, one source

| Typed source | Request log | `claude-plugins.json` `source` (stored verbatim) | `info` `source` |
|---|---|---|---|
| `acme/tools` | `GET /acme/tools.git/info/refs?service=git-upload-pack 200`, `POST /acme/tools.git/git-upload-pack 200` | `acme/tools` | `{sourceKind: github, owner: acme, repo: tools}` |
| `https://github.com/acme/tools` | same | `https://github.com/acme/tools` | same |
| `https://GitHub.com/acme/tools` | same | `https://GitHub.com/acme/tools` | same |
| `https://www.github.com/acme/tools` | same | `https://www.github.com/acme/tools` | same |
| `https://github.com/acme/tools.git` | same | `https://github.com/acme/tools.git` | same |
| `https://github.com/acme/tools/` | same | `https://github.com/acme/tools/` | same |

The `add` result is the same for every row: `kind cascade`, `severity info`, `needs reload false`, and the row `tools | project | added`. `marketplace list` JSON rows carry no source field (only `details.autoupdate` and `details.lastUpdatedAt`). So "list in github.com terms" means that no `{git host}` value appears in list output. The parse is verified in `domain/source.ts`. `gitHubUrlPath` folds the host to lower case, strips `www.` and `:443`, and compares it to `github.com` [VERIFIED: source.ts:597-616]. `stripGitHubUrlDecorations` strips trailing slashes and then `.git` [VERIFIED: source.ts:543-546].

### SRC-03: refs

| Typed | Result | Request log | `info` source | Content (`list --available`) |
|---|---|---|---|---|
| `acme/tools@stable` | added | 200/200 on `/acme/tools.git/...` | `{github, acme, tools, ref: stable}` | stable content |
| `https://github.com/acme/tools#stable` | added | same | same | stable content |
| `acme/tools#stable` | **failed `source missing`** | `GET /acme/tools 404` | — (not added) | — |

The `acme/tools#stable` payload: severity `error`, summary `Some operations have failed.`, marketplace row `acme/tools#stable | project | failed` with one child row: `status failed`, `name`/`id` `acme/tools#stable`, `reasons source missing`, cause chain `HTTP Error: 404 Not Found`, `fetched https://{git host}/acme/tools#stable.git`.

Root cause [VERIFIED: source.ts:406-424, :446-458]. `parseShorthandSourceForm` handles only `@` (`raw.lastIndexOf("@")`). A one-slash string goes to `parseOwnerRepo`, which splits on `/`, so `repo = "tools#stable"`. A direct parser probe confirmed `{"kind":"github","raw":"acme/tools#stable","owner":"acme","repo":"tools#stable"}` and the wire URL `https://github.com/acme/tools#stable.git`.

Upstream: Claude Code 2.1.296 (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.296/claude`, grepped 2026-10-21) parses the shorthand with `n.match(/^([^#@]+)(?:[#@](.+))?$/)` and returns `{source:"github",repo:g,ref:m}` [VERIFIED: binary grep]. So upstream accepts `owner/repo#ref`. The milestone research table (`.planning/research/FEATURES.md:177`) says "Here: Yes" for "`owner/repo#ref` pins a ref". That is wrong for the shorthand and right only for the URL form.

### ADD-11: add 401 (the repository is armed with `credential alice/s3cret`)

**github, no credential** (`acme/tools`; `https://github.com/acme/tools` has the same shape with `name`/`id` set to the typed URL):

```text
severity error, needs reload false, summary "Some operations have failed."
marketplaces: [ { name: "acme/tools", scope: project, status: failed, plugins: [
  { status: failed, name: "acme/tools", id: "acme/tools", reasons: [authentication required], scope: project,
    cause: { causeChain: ["The operation was canceled.", "fetched https://{git host}/acme/tools.git"], truncated: false },
    leaks: [], rollbackPartial: [] } ] } ]
request log: GET /acme/tools.git/info/refs?service=git-upload-pack 401
```

**url, no credential** (the shape `url-source.feature:112-126` pins):

```text
severity error, needs reload false, summary "A marketplace operation has failed."
marketplaces: [ { name: "https://{git host}/acme/tools.git", scope: project, status: failed, reasons: [authentication required], plugins: [] } ]
request log: GET /acme/tools.git/info/refs?service=git-upload-pack 401
```

Why they differ [VERIFIED: orchestrators/marketplace/add.ts:758-788]. `failedAddRow` returns a bare row only when `hostFrame === undefined && !hasFetchedUrlCause(error)`. A rewritten github call always carries a `FetchedUrlCause` [VERIFIED: platform/git.ts:377-397]. This is GHB-01/GHB-04 by design.

**With a stored credential** (all three sources): `severity info`, row `tools | project | added`. The request log is `GET …info/refs 401`, then `GET …info/refs 200`, then `POST …/git-upload-pack 200`. This is the same for url and github.

### UPD-12: update 401 (add succeeded, a new commit was pushed, then the repository was armed)

**url** (passes today):

```text
severity error, needs reload false, summary "Some operations have failed."
row: marketplace tools/project/failed; child id "tools@tools", name tools, status failed, reasons authentication required, scope project
cause chain: Failed to update marketplace "tools"., The operation was canceled., no credential was obtained for {git host}; store one with: printf 'protocol=https\nhost={git host}\nusername=<user>\npassword=<token>\n\n' | git credential approve
request log: GET /acme/tools.git/info/refs?service=git-upload-pack 401
```

**github, current code** (fails UPD-12, because there is no remedy line):

```text
cause chain: Failed to update marketplace "tools"., The operation was canceled., fetched https://{git host}/acme/tools.git
```

**github, with trial fix P-2** (measured in the scratch tree):

```text
cause chain: Failed to update marketplace "tools"., The operation was canceled., no credential was obtained for {git host}; store one with: printf 'protocol=https\nhost={git host}\nusername=<user>\npassword=<token>\n\n' | git credential approve, fetched https://{git host}/acme/tools.git
```

The remedy text [VERIFIED: orchestrators/auth-host.ts:124-125]:

```ts
export const NO_STORED_CREDENTIAL_CAUSE: (host: string) => string = (host) =>
  String.raw`no credential was obtained for ${host}; store one with: printf 'protocol=https\nhost=${host}\nusername=<user>\npassword=<token>\n\n' | git credential approve`;
```

The url arm attaches the remedy only when `err.cause === undefined` and the bundle is `stored-credential` [VERIFIED: orchestrators/marketplace/shared.ts:346-392, line 388 `err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(host));`]. The github arm calls `refreshGitHubClone` with no such catch [VERIFIED: orchestrators/marketplace/update.ts:382-409]. Under the override, `buildGitHubAuth` returns a `stored-credential` bundle bound to the override host [VERIFIED: auth-host.ts:222-235]. So by GAUTH-04's own rule, the line belongs there. Even if the url condition were copied over, it would skip the github arm, because `FetchedUrlCause` already fills `err.cause`. The trial fix wrapped instead: `err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(auth.host), { cause: err.cause })`, guarded by `auth.kind === "stored-credential" && classifyGitTransportFailure(err) === "authentication required"`. With the override unset, the github bundle is `device-flow`, so GHB-04's byte-identical guarantee holds.

## Inventory of `@github` rows (dry run with a scratch `"tags": "@github"` config; 39 scenarios)

Status in the scratch tree with only Patterns 1 and 2 applied:

| File | Rows | Scratch result | Needs |
|---|---|---|---|
| `features/marketplace/add.feature` | 4 (lines 34, 95, 147, 206) | pass | arms only |
| `features/marketplace/autoupdate.feature` | 1 (82) | pass | arms only |
| `features/marketplace/git-source.feature` | 8 (re-add, list, info, remove; project and user) | pass | arms only |
| `features/marketplace/info.feature` | 1 (44, `acme/tools#main`) | **fail** at `Given the user has run "…add acme/tools#main…"` (`'error' !== 'info'`) | P-1, then move to `#stable` (D-03) |
| `features/marketplace/remove.feature` | 5 (40, 41, 690, 730, 762) | pass | arms only. The three LAYER-07 rows need the SC5 red proof. |
| `features/marketplace/unsupported-source.feature` | 4 (29-32) | pass | arms only. IN-05 is wording. |
| `features/marketplace/update.feature` | 15 (148…955) | pass | arms only |
| `features/plugin/cross-scope-install.feature` | 1 (71) | pass | arms only |

Wall time for 39 scenarios: 13.1 s, with 8 workers.

### SC5 red proof on the `@github` rows (measured in the scratch tree)

The `09-08-RED.json` diff was applied to `resolveTargetScopeMarketplace` (`install-outcome.ts`, the `return addTargetScopeMarketplace(...)` at the end becomes `void marketplaceAdd; const copy = { ...source.sourceRecord, scope: opts.scope, plugins: {} }; setOwn(state.marketplaces, marketplace, copy); return copy;`). Then this ran: `cucumber-js -c <rel gh.json> features/marketplace/remove.feature features/plugin/cross-scope-install.feature --parallel 1`. Result: exit 1, 6 scenarios, 3 failed and 3 passed. The failures were `remove.feature:690`, `:730`, and `:762`, each at `Then the result has these fields:`. The empty-remove rows (40, 41) and the cross-scope install row (71) passed. After the restore, 6 of 6 passed. Record it as `10-XX-RED.json`. `gsd-tools check tdd-red-evidence` accepts only a record inside the phase directory (09-08 deviation 3).

## Phase 9 info findings: current code and concrete fix

| ID | File (verified this session) | Current | Fix |
|---|---|---|---|
| IN-01 | `tests/architecture/https-git-host-cgi.test.ts:83-89` | `assert.throws(() => parseCgiResponse(backendOutput), Error);` | Assert `{ name: "Error", message: "the CGI response has no blank line after its headers" }`. Add a case for `Buffer.from("NoColon\r\n\r\n")` that expects message `the CGI response header "NoColon" has no colon` [VERIFIED: cgi.ts:78, :86]. |
| IN-02 | `CHANGELOG.md:5-7` | two top-level bullets, and the first is one long sentence | Fold into the branch's single entry as sub-bullets, and split the sentence (09-REVIEW gives the wording). This phase's own changes (P-1, P-2) need lines too. Read the changelog skill rules. |
| IN-03 | `features/lib/https-git-host/server.ts:60-64` | "drops the connection on the first request" | "drops the connection on every request". The `drop` arm destroys every matching request until reset [VERIFIED: server.ts:200-204]. |
| IN-04 | `features/step_definitions/marketplace/git-host.steps.ts:86-87` | "A request over a kept-alive socket, or a non-TLS attempt that never becomes a request, still counts as a connection." | Use 09-REVIEW's wording: a request over a kept-alive socket shows only in the requests, and a non-TLS attempt shows only in the connection count, so the step asserts both. |
| IN-05 | `features/marketplace/unsupported-source.feature:3-5, 17, 23-24` | the description says every form that can name a host is pointed at the host; `git@127.0.0.1:acme/tools.git` (ssh, port 22) and `~other/marketplaces/tools` can never reach it | Say in the description that the host check covers the forms that name the host's address. Then either amend `.agents/skills/cucumber/rules/steps.md` ("Log steps appear only in the feature files of the git source kinds") to also allow the refused-source feature, or move the Outline into `git-source.feature` (it has untagged local rows, so a move is awkward). Recommendation: change the description and amend steps.md. |
| IN-06 | `server.ts:167-179` (`armFor` on `req.url`), `server.ts:407`, `cgi.ts:51` (`PATH_INFO: decodeURIComponent(request.url.pathname)`) | the arm matches the raw path | In `receive`, compute `decodeURIComponent(new URL(req.url, base).pathname)` once inside a `try`. Answer 500 (logged) on `URIError`, then pass that pathname to `armFor`. Keep `logged.path` as sent, because the request log shows the path as sent. |
| IN-07 | `features/support/pi-process.ts:56-83, 115-120` | `piRun` is assigned after `PiProcess.start`, and `AfterAll` stops at the first throw | In `BeforeAll`, wrap `PiProcess.start` in `try/catch`. On failure, `await gitHost.close()` and `rm(root)`, then rethrow. In `AfterAll`, run Pi stop, host close, and `rm` in that order. Collect every failure (for example, each in its own `try`, or `Promise.allSettled` per stage), and throw one `AggregateError`. This mirrors `world.release()`. |
| IN-08 | `docs/json-output.md:580`, `CHANGELOG.md:7` | "names the source as typed" | "When a failed `marketplace add` has a child row, the row names the source after redaction, and its id is that name alone." Hand-written table, so let mdformat realign it. Fix the CHANGELOG wording too. Note that github add failures always have the child row (measured above). |
| IN-09 | `server.ts:235-248` | `logged.status = 500` even when `res.headersSent` destroys the response | In the `headersSent` branch, set `logged.status = "dropped"`, and widen the `GitHostRequest.status` doc (server.ts:86-90) to "the host destroyed the connection". |
| IN-10 | `server.ts:421-449` | no test drives `answer()`/`answerServerError()` | Add one `tests/architecture/` case. Start `HttpsGitHost` in a `mkdtemp` root, request `/acme/%E0%A4%A.git/info/refs` over `https` with `ca: readFileSync(host.certificatePath)`, and assert status 500, a log entry with `500`, and a live server (a second request answers). Close in `t.after`. It needs `openssl` and `git` on PATH, which the CI static job has. |
| IN-11 | `features/marketplace/info.feature:36-44` | git rows add at `#main` | D-03: the ref-capable fixture, and git rows at `#stable` (`https://{git host}/acme/tools.git#stable`; `acme/tools#stable` after P-1). See Pattern 3(b). |

**New stand-in defect, beyond IN-xx (call it HOST-EPIPE):** `features/lib/https-git-host/cgi.ts:145` `child.stdin.on("error", reject);` and `:160` `child.stdin.end(body);` [VERIFIED]. `git http-backend` may exit before it reads stdin for a GET with an empty body. Node 24 then raises `write EPIPE` on stdin, the promise rejects, and the host answers 500. That is the logged stack (`Socket.end` → `afterWriteDispatched`, from `cgi.ts:160`). Fix: ignore `EPIPE` on stdin and let the exit code decide. Trialled code:

```ts
// A backend that needs no body may exit before it reads stdin; its exit code decides.
child.stdin.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") {
    reject(error);
  }
});
```

## Common Pitfalls

### Pitfall 1: D-09 assumes one payload shape for add 401
**What goes wrong:** One Outline with url and github rows cannot state both a bare marketplace row and a child row with a cause. `recordTable` builds its header from the actual records, so the url record lacks the plugin columns [VERIFIED: features/lib/field-rows.ts:90-96; command.steps.ts:52-61]. The summary also differs.
**How to avoid:** Get a user decision (Open Question 1) before planning that Outline. Update 401 and add-with-credential have one shape, so they fit D-09 as written.

### Pitfall 2: The `@github` rows are excluded until the switch-on
**What goes wrong:** `npm run test:cucumber -- --tags @github` runs 0 scenarios while `cucumber.json` has `not @github`.
**How to avoid:** Use a scratch config passed by a path relative to the cwd, or put the scenarios in a github-only feature file with no tags (see the next pitfall).

### Pitfall 3: Untagged github scenarios run in every default run
**What goes wrong:** Scenarios in a new `github-source.feature` have no tag (tags appear only on Examples, and only to separate kinds inside a shared Outline). They run in `npm run check` from their first commit.
**How to avoid:** Land the override wiring and the fixture arms before any github-only scenario. Land P-1 before the SRC-03 `#` row turns green, and commit the RED evidence first.

### Pitfall 4: Node 24 failures are flakes from the stand-in, not from Pi
**What goes wrong:** On Node 24.21.0, current `HEAD` failed 2 and then 1 url scenarios in two runs (`git-source.feature:56`, `url-source-update.feature:27`, `update.feature:313`). The url-source-update row fails because the expected status is replaced by an unarmed 500. CI's only behavioral job runs Node 24 [VERIFIED: .github/workflows/ci.yml:126-145, `node-version: "24"`, `timeout-minutes: 10`].
**How to avoid:** Fix HOST-EPIPE in the first plan, before any Node 24 run. Phase 9's open assumption A2 (Node 24 gives the same phrases) holds locally after the fix: 3 of 3 runs, 412 of 412 passed on 24.21.0.

### Pitfall 5: The gpg daemon in the hostile control
**What goes wrong:** The positive control (`commit.gpgsign=true` inherited) starts `keyboxd --homedir <hostile home>/.gnupg --daemon`, which keeps running.
**How to avoid:** Kill it afterwards, or point `GNUPGHOME` into the scratch tree and kill by homedir. Remove the hostile tree at the end.

### Pitfall 6: Gherkin escapes in the credential cause cell
**What goes wrong:** `\n` in a table cell becomes a newline, and `|` ends the cell.
**How to avoid:** In the cell, write `printf 'protocol=https\\nhost={git host}\\nusername=<user>\\npassword=<token>\\n\\n' \| git credential approve`. Never name an Examples column `user` or `token`.

### Pitfall 7: Probe sandboxes must empty directories, not recreate them
**What goes wrong:** While building the probe, I deleted and recreated Pi's cwd. Every `git credential fill` that Pi spawned then failed, because its cwd no longer existed, and the auth rows looked like product bugs.
**How to avoid:** Empty the directories in place, as `Before()` does [VERIFIED: features/support/pi-process.ts:95-102]. This matters for any by-hand control.

### Pitfall 8: Red evidence classifier path
`gsd-tools check tdd-red-evidence` refuses a record path outside the project (09-08 deviation 3). Write a temporary copy in the phase directory, check it, then delete it.

## Code Examples

### github arm of `publishMarketplaceIn` (trialled)
```ts
case "url":
case "github": {
  const { gitHost } = sites;
  const bareRepository = gitHost.repositoryPath(directory);
  await writeMarketplace(root, name, plugins, manifestPath);
  await publishGitRepository(root, bareRepository, gitHost.gitHome);
  return {
    kind, root,
    source: kind === "url" ? gitHost.repositoryUrl(directory) : `acme/${directory}`,
    manifestPath, repository: directory, bareRepository, gitHome: gitHost.gitHome,
  };
}
```

### P-1: shorthand `#ref` (trialled; `tests/domain/source.test.ts` stayed 161/161)
```ts
function parseShorthandSourceForm(raw: string): ParsedSource {
  const hashIdx = raw.indexOf("#");
  if (hashIdx !== -1) {
    const github = parseOwnerRepo(raw.slice(0, hashIdx), raw);
    const ref = raw.slice(hashIdx + 1);
    if (github.kind === "github" && ref.length > 0) {
      return { ...github, ref };
    }

    return { kind: "unknown", raw, reason: nonRelativeReason(raw) };
  }

  const atIdx = raw.lastIndexOf("@");
  // ... unchanged
```
New unit cases are needed for 100% direct coverage: `acme/tools#stable` gives github with ref `stable`; `acme/tools#` gives unknown; `acme#x` gives unknown. Edge: upstream splits at the first `#` **or** `@`. Pi keeps D-76-04's split on the last `@` (a recorded decision), so `acme/tools@v1#x` differs from upstream. That is out of scope, but note it.

### P-2: credential line on the github update arm (trialled)
```ts
try {
  await refreshGitHubClone(cloneDir, source.ref, gitOps, () => { cloneAdvanced = true; }, auth);
} catch (err) {
  if (err instanceof Error && auth.kind === "stored-credential" &&
      classifyGitTransportFailure(err) === "authentication required") {
    err.cause = new Error(NO_STORED_CREDENTIAL_CAUSE(auth.host), { cause: err.cause });
  }

  throw err;
}
```
`classifyGitTransportFailure` is already imported in `update.ts` (line 117). Do not import it twice: the trial failed with `Identifier 'classifyGitTransportFailure' has already been declared`. Mirror `refreshUrlClone`'s `CrossOriginChallengeError` exclusion. A cleaner home is a `shared.ts` helper beside `refreshUrlClone`, with unit cases in `tests/orchestrators/marketplace/{update,shared}.test.ts`. Existing cases pin the url line at `update.test.ts:518, :996, :1034` and `shared.test.ts:735`. `update.test.ts:5208` already exercises GHB-02 with the override.

## Suite-close mechanics (measured)

| Check | Command | Result here |
|---|---|---|
| Whole suite, Node 26 | `npm run test:cucumber` (or `node node_modules/@cucumber/cucumber/bin/cucumber.js`) | scratch, github on: 412 of 412, 12.5 s cucumber, 14.7 s wall, 763 MB max RSS |
| Whole suite, Node 24 | `npx --prefer-offline -y -p node@24.21.0 -- node node_modules/@cucumber/cucumber/bin/cucumber.js` | **before HOST-EPIPE fix:** 404/412 and 401/412 (HEAD alone: 371/373, 372/373). **After:** 412/412 three times, about 19 s cucumber, 22 s wall |
| Pi under the same Node | `PiProcess` spawns `process.execPath` [VERIFIED: tests/e2e/_rpc.ts:377] | so Pi also runs on Node 24 in the Node 24 run |
| Optional Node 22 | `/usr/bin/node node_modules/@cucumber/cucumber/bin/cucumber.js` | not run. 22.22.2 is in the engines range |
| Usage report | `npx cucumber-js --dry-run --format usage \| grep -c UNUSED` | scratch with no exclusion: 0 `UNUSED`, exit 0. HEAD with the exclusion: 0 |
| Feature gate | `npm run check:features` | part of `check:static` |
| Hostile control (Linux, by hand) | see below | 412 of 412 passed. The marker stayed absent. The positive control bit. |
| CI timing (D-08) | read from the PR's `behavioral tests (Node 24)` job at milestone close | no CI run of this branch exists yet (`gh run list --branch features/cucumber-behavioral-tests` returned `[]`) |

**Hostile control recipe (by hand, never committed; Linux).** Everything lives in the scratchpad. Nothing reads or writes the real `~/.gitconfig` or `/etc/gitconfig`.

1. Write `hostile/helper.sh`: `cat >/dev/null`, then `touch hostile/marker`, and on `get` print `username=alice` and `password=s3cret`. Write `hostile/home/.gitconfig` and a copy, `hostile/system-gitconfig`, with `init.defaultBranch=master`, `commit.gpgsign=true`, `user.signingkey=DEADBEEF`, `credential.helper=<helper>`, and `url."https://example.invalid/".insteadOf=https://127.0.0.1`.
2. Positive control (proves the config bites a git that inherits it), with `HOME=hostile/home GIT_CONFIG_SYSTEM=hostile/system-gitconfig`: `git init` gives `refs/heads/master`, `git commit` gives `error: gpg failed to sign the data`, and `git credential fill` returns `username=alice` and writes the marker. All three were measured. Delete the marker.
3. Run the suite with `HOME=hostile/home GIT_CONFIG_GLOBAL=hostile/home/.gitconfig GIT_CONFIG_SYSTEM=hostile/system-gitconfig node node_modules/@cucumber/cucumber/bin/cucumber.js`. Use node directly, because `npx` would use the hostile HOME for its cache. Measured: 412 of 412 passed, and the marker was absent.
4. Kill the `keyboxd` that step 2 started, then remove `hostile/`.

Optionally, repeat Phase 9's run "c" (drop `GIT_CONFIG_NOSYSTEM` from a local edit of `rpcChildEnvironment`) to show that the system helper would leak without it. The Phase 9 record already holds that evidence.

**macOS (LOW confidence, cannot be verified here):** Apple's git may read credential settings from places that `GIT_CONFIG_NOSYSTEM` does not cover, for example a config bundled with Xcode command-line tools that sets `credential.helper=osxkeychain` [ASSUMED]. CI is Linux only. Record macOS as not verified.

## State of the Art

| Old | Current | Impact |
|---|---|---|
| `cucumber.json` `"tags": "not @github"` | no `tags` key (D-07) | `features.md`'s exclusion paragraph and the SKILL.md review paragraph (which warns that the usage report honors the exclusion) need rewording. `scripts/check-features.mjs` header already says "the profile's tag exclusion" (09-08). |
| Phase 9 assumption A2 (Node 24 phrases) open | measured locally on 24.21.0 after HOST-EPIPE | A1 (OpenSSL 3.0.13) and A4 (`git http-backend` on ubuntu-latest) stay open until the PR job runs |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CI's ubuntu-latest has OpenSSL 3.0.13 and `git http-backend` (carried from 09-RESEARCH A1/A4) | Standard Stack | The PR behavioral job fails on certificate generation or CGI |
| A2 | Apple git on macOS may read a credential helper that `GIT_CONFIG_NOSYSTEM` does not suppress | Hostile control | A macOS developer's keychain could answer a scenario's 401 |
| A3 | Hand-setting `fixed` dispositions (with commit SHAs in Source) in `09-REVIEW-DISPOSITION.md` is preserved by the ledger tool, as its footer says for `deferred` | D-04 | The ledger is regenerated with `open` rows. Alternative: run the code-review-fix flow for Phase 9. |
| A4 | The CI runner (4 vCPU, assumed) runs 412 scenarios with `parallel: 8` well inside the 10-minute job timeout | D-08 | Change `parallel` only if it nears the timeout (D-08) |

## Open Questions (for the user before planning locks them)

1. **D-09 and the add-401 shape (blocks the add-without-credential Outline).**
   - Known: url gives a bare row (`reasons` on the marketplace row, summary `A marketplace operation has failed.`). github under the override gives a child row with cause `The operation was canceled., fetched https://{git host}/acme/tools.git` (summary `Some operations have failed.`). The difference is by design (GHB-01). Changing it is WINDOWS #100 territory, which D-05 defers.
   - Recommendation: keep D-09 for "add with a stored credential succeeds" and "update answered 401" (one shape each). Split "add without a credential" by kind: the url scenario stays a single scenario, now in `git-source.feature`, and a github Outline has three rows (`acme/tools`, `https://github.com/acme/tools`, plus a third such as `https://github.com/acme/tools.git`) to meet the three-variant rule.
2. **P-1, the shorthand `owner/repo#ref` (needed for SRC-03 and the info row).** It is in the requirement's wording and it restores upstream parity (Claude Code 2.1.296 accepts it). It changes user-visible parsing, and D-13 says such a change "touches upstream parity, stops for the user's decision." Recommendation: approve it as a test-first fix with a CHANGELOG line, and reject an empty ref (`acme/tools#`), as upstream does.
3. **P-2, the credential line on github update under the override (needed for UPD-12 gh and D-10).** It affects only the Pi-only override path (D-MF-01). With the override unset, nothing changes. The open choice is the chain order: the remedy before the `fetched …` tail (trialled) or after it. Recommendation: remedy, then `fetched` (trialled), so the fetched URL stays the last link, as GHB-01 says.
4. **Placement of the stable branch for the info Outline (D-03).** Pattern 3(b): every git publication also pushes `stable`, which tracks `main`, or the git info rows move out of the shared Outline. This is Claude's discretion, but it changes every git fixture, so the planner should state the choice.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git + `git http-backend` | stand-in, fixtures | ✓ | 2.55.0 | — |
| openssl | stand-in certificate | ✓ | 4.0.3 | — |
| Node 26 | default runs | ✓ | 26.11.1 | — |
| Node 24 | D-06 | ✓ (npx cache) | 24.21.0 | `npx -p node@24` downloads if the cache is cleared (network) |
| Node 22 | optional | ✓ | 22.22.2 (`/usr/bin/node`) | — |
| gh CLI | D-08 read at PR time | ✓ | — | — |
| Claude Code binary (parity evidence) | P-1 | ✓ | 2.1.296 | docs |
| macOS | hostile control on macOS | ✗ | — | record as not verified |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` 13.3.0 (behavioral). `node:test` (unit and architecture). |
| Config file | `cucumber.json` (`parallel: 8`, `order: random`; `tags` removed in the last plan) |
| Quick run command | `npm run test:cucumber -- features/marketplace/github-source.feature` (or a scratch `@github` config passed by a relative path, before the switch-on) |
| Full suite command | `npm run check` (static checks, check:features, unpaired, integration, cucumber, direct coverage) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADD-11 (url) | add 401 without a credential fails; with a stored credential, it succeeds | cucumber | `npm run test:cucumber -- features/marketplace/git-source.feature` | ✅ in `url-source.feature:112-144`, folds into git-source |
| ADD-11 (gh) | the same through the override | cucumber | same | ❌ new rows |
| UPD-12 (url, gh) | update 401: whole cause chain with the `git credential approve` remedy for `{git host}` | cucumber + unit (P-2) | same; `node --test tests/orchestrators/marketplace/update.test.ts` | ❌ new Outline; ❌ new unit case |
| SRC-02 | 5 spellings: one request path, the same info, a verbatim declaration | cucumber | `npm run test:cucumber -- features/marketplace/github-source.feature` | ❌ new file |
| SRC-03 | `@stable` / `#stable` / URL `#stable` clone stable content, and info shows ref `stable` | cucumber + unit (P-1) | same; `node --test tests/domain/source.test.ts` | ❌ new; ❌ new unit cases |
| SC1/SC5 | all 39 `@github` rows; the LAYER-07 red proof | cucumber | `npm run test:cucumber -- --tags @github` (after the switch-on) | ✅ rows exist |
| SC4 | Node 24/26 whole suite, usage report, hostile control | manual + cucumber | the commands in Suite-close mechanics | — |
| IN-01, IN-10 | parser negatives; host 500 path | unit (architecture) | `node --test tests/architecture/https-git-host-cgi.test.ts` | ✅ file; ❌ new cases |

### Sampling Rate
- **Per task commit:** the hook's `check:commit`, plus the targeted cucumber file (seconds).
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the final tree, plus the recorded Node 24 and Node 26 whole-suite runs, plus two more random-order runs.

### Wave 0 Gaps
- [ ] `RpcGitEnvironment` override field and its architecture test.
- [ ] github fixture arms, and HOST-EPIPE, before any github scenario or Node 24 run.
- [ ] A branch-publishing fixture helper and its step.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (test credentials) | credentials only in the sandbox HOME (`.git-credentials` mode 0600). The stand-in compares Basic auth in memory and logs only the status. |
| V5 Input Validation | yes | `domain/source.ts` parser (P-1). Override validation (GHB-03, unchanged). |
| V8 Data Protection | yes | AUTH-09: no credential is ever in a cause or row. `tests/architecture/no-credential-leak.test.ts` stays green. The P-2 line interpolates only the host. |
| V3, V4, V6 | no | — |

| Threat | STRIDE | Mitigation |
|---|---|---|
| The operator's own credential helper answers a scenario | Information disclosure | `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL` in the sandbox, the allowlist environment. The hostile control shows it holds (Linux). |
| A scenario reaches the real github.com | Tampering / disclosure | The override is set for every Pi of the run. Refused forms assert an empty request log. `PI_OFFLINE=1`. |
| The operator's own override value leaks in | Tampering | The allowlist builds the environment from scratch. Plant the variable in the architecture test. |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `features/lib/{published-marketplace,git-marketplace,hermetic-git,run-tokens,field-rows,pi-process,pi-commands,path-marketplace}.ts`, `features/lib/https-git-host/{server,cgi}.ts`, `features/support/{pi-process,world,https-git-host,source-kind}.ts`, `features/step_definitions/{command,marketplace/*}.steps.ts`, `features/marketplace/{url-source,url-source-update,git-source,info,unsupported-source}.feature`, `tests/e2e/_rpc.ts`, `tests/architecture/{hermetic-git-environment,https-git-host-cgi}.test.ts`, `extensions/pi-claude-marketplace/{shared/github-base-url,orchestrators/auth-host,domain/source,orchestrators/marketplace/{add,update,shared},platform/git,shared/errors}.ts`, `scripts/check-features.mjs`, `cucumber.json`, `.github/workflows/ci.yml`.
- Measured runs (scratch tree and probe, session scratchpad `phase10-research/`): `gh-run.txt`, `sc5-red.txt`, `sc5-green.txt`, `all-26.txt`, `all-24*.txt`, `head-24-*.txt`, `hostile-run.txt`, `spell.out`, `ref.out`, `auth.out`, `auth2.out`, `upd.out`, `usage*.txt`.
- Claude Code binary 2.1.296: the shorthand regex `/^([^#@]+)(?:[#@](.+))?$/`.

### Secondary (MEDIUM)
- `.planning/phases/09-*/09-RESEARCH.md` A1/A4 (CI OpenSSL, git-http-backend), not re-verified.

### Tertiary (LOW)
- macOS git credential behavior (A2).

## Metadata

**Confidence breakdown:**
- Override wiring and github fixture: HIGH. Trialled, and 38/39 passed.
- Product defects P-1 and P-2: HIGH. Measured, with trial fixes measured.
- HOST-EPIPE and Node 24: HIGH locally. CI still to be confirmed at PR time.
- Hostile control: HIGH on Linux, LOW on macOS.

**Research date:** 2026-10-21
**Valid until:** 2026-11-20 (stable code). Re-measure if `features/lib/https-git-host/` or `domain/source.ts` changes first.
