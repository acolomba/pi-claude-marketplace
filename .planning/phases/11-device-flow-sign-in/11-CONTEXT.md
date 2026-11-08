# Phase 11: Device Flow Sign-In - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning
**Mode:** autonomous smart discuss in a child session; the user's standing instruction is to take the recommended answer at every question, so each decision below is the recommendation, auto-accepted.

<domain>
## Phase Boundary

Phase 11 adds the cucumber scenarios that pin GitHub Device Flow sign-in end to end, through the Phase 1 stand-ins (the loopback sign-in stand-in, the in-process GitHub redirect, and the run's git host): a `marketplace add` of a GitHub source that needs a credential the user has not stored (DFLOW-01), a sign-in that the stand-in denies or lets expire (DFLOW-02), an `install` from a GitHub git source on a cache miss and on a cache hit (DFLOW-03), and the background autoupdate pass with and without a stored credential (DFLOW-04). It owns `features/marketplace/device-flow.feature` (with the two Phase 1 seeds) and a new verb module `features/step_definitions/marketplace/device-flow.steps.ts`. It fixes a product bug that a scenario exposes only inside its product row: `domain/{github-auth,auth-registry}.ts`, `orchestrators/auth-host.ts`, `platform/{git-credential,git-auth-callbacks}.ts`, the auth call in `orchestrators/plugin/clone-cache.ts`, and the credential choice in `orchestrators/marketplace/background-pass.ts`, with their unit pairs. It adds no feature.

</domain>

<decisions>
## Implementation Decisions

### The sign-in contract (D-BG-1101)

- **D-BG-1101 — the contract is the project's own, and the scenarios pin it as the product renders it.** Claude Code runs no Device Flow: it clones with the system git and the user's credential helpers, and it sets `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never` on the git it runs without a terminal (read from the 2.1.319 binary). This extension clones through isomorphic-git, which has no credential prompt, so its GitHub sign-in is the project's own contract (AUTH-01, D-79-04, D-79-05, GHB-02), a Pi capability gap. The scenarios pin the product's rows, the stand-in's request log, the redirect's routing log, and the git host's request log as whole tables. Claude Code is the reference only for DFLOW-04: a background pass never prompts.
- A sign-in shows the user a `device-flow-prompt` result row with the verification URI and the user code, before the command's own result row (the seed's shape). The scenarios keep that two-row form for both `marketplace add` and `install`.
- Only a scenario that runs without `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` reaches Device Flow (GHB-02). Every scenario of this phase therefore starts its Pi with `pi runs with github's requests routed to the stand-ins` and a poll script (`github's sign-in answers its polls with these outcomes:`), and none carries an MCP implementation tag (D-BG-04): they run once, under `adapter`.

### Where the credential lives and how the next command finds it (D-BG-1102)

- **D-BG-1102 — the token lives in the user's git credential helper, and the scenarios read it from the credential store file.** After an authorized sign-in, the product runs `git credential approve` for host `github.com` with the username `x-access-token` and the issued token (`GITHUB_PROVIDER.credentialFrom`). With `the user's git keeps credentials in its credential store`, git's `store` helper writes it to `.git-credentials` in the sandbox HOME, a file the user reads. The phase's verb module adds the steps that read that file: one that lists the stored credentials as a whole table (protocol, host, user, password) and one that states the store holds none. The steps read only the sandbox HOME, never the real one.
- The next command finds the token through `git credential fill` before any sign-in (AUTH-02). A DFLOW-01 scenario signs in through `marketplace add`, then runs a second command that reaches the same repository (`marketplace update tools --scope user`): the git host answers 401, then 200 with the stored token, and the sign-in stand-in receives no request.

### What each failure reports (D-BG-1103)

- **D-BG-1103 — a denied or expired sign-in is the bare `authentication required` row, and nothing is left.** A `device-flow` bundle gets no stored-credential cause line (GAUTH-05: a declined or expired Device Flow is the whole story behind the bare closed-set token). The DFLOW-02 scenario is one outline over the poll outcomes `access_denied` and `expired_token`. It pins the whole result (the prompt row and the failed row, with its reasons and cause chain as the product renders them), and then: the user scope holds no marketplace record, no marketplace checkout, and no git clones; `claude-plugins.json` of the user scope does not exist; the credential store holds no credential; the git host saw the one 401; the stand-in saw the code request and the polls up to the terminal outcome.
- If a scenario shows that a failure leaves a record, a clone, or a credential, or reports any reason other than `authentication required`, that is a product bug: fix it inside the owned product row with Claude Code's rule (a failed operation leaves nothing) as the reference, or, outside the row, record a parent line and a dubious choice.
- Print mode (`DeviceFlowUnavailableError`) and a stand-in that answers 500 are not in the success criteria; they stay out of this phase.

### Install from a GitHub git source (D-BG-1104)

- **D-BG-1104 — the cache-miss install runs the same flow, and the cache-hit install runs none.** The miss: a dir-source marketplace offers a plugin whose source kind is `github`; the git host requires `x-access-token` with `stand-in-access-token` for that plugin; the install shows the prompt row and the installed row, the git host sees 401, 200, and the pack request, the stand-in sees the code request and the polls, and the redirect routed every request. The hit: two plugins pinned to one commit of one repository (the shape of `plugin/git-source.feature`'s pinned scenario); the first install signs in as a Given, and the second install is the `When`. The scenario does not configure a credential store, so the token is not kept, and its poll script holds exactly one authorization: an install that went to the network would need a second sign-in and fail on the exhausted script. The `Then`s state the installed row, no git host request, and no sign-in request.

### The background pass (D-BG-1105, D-BG-1106)

- **D-BG-1105 — the background pass never starts a Device Flow.** Both DFLOW-04 scenarios run in a terminal session, as the second seed does: the marketplace is added while its repository needs no credential, autoupdate is turned on, then the git host starts requiring the credential. Without a stored credential the stand-in receives no request, the git host receives the one 401, and the session shows no notice (the pass reports nothing to the session). With a stored credential (`the user has stored a credential for the git host ...` is the override-host form, so the scenario stores `x-access-token` for `github.com` through the phase's own Given, which writes the sandbox credential store) the pass fetches with it: the git host sees 401, 200, and the pack request, and the stand-in receives no request.
- **D-BG-1106 — the seeds stay.** The first seed is DFLOW-01's main scenario; the phase extends it with the credential store check rather than duplicating it. The second seed stays as the routing proof for a terminal session's background requests. Every step that only the seeds use stays in use.

### Claude's Discretion

- The exact wording of scenario titles and of the new steps, within `.agents/skills/cucumber/rules/{features,steps}.md`.
- Whether the Given that stores a GitHub credential takes the user and the password as parameters or names the stand-in's token; either way the table or the step names the whole literal.
- How the plans split: the phase has one feature file and one verb module, so plans that touch them run in sequence, in separate waves.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/step_definitions/git-host.steps.ts` (frozen): the poll script, the redirect start, the credential-store config Given, the stand-in and routing log Thens, `the git host requires the user {string} with the password {string} for the {git repository}`, `the user has stored a credential for the git host ...` (writes `https://user:password@<git host address>`, so it suits the override host only), `the git host receives these requests:` and `the git host receives no request`.
- `features/step_definitions/marketplace/checkout.steps.ts`: `the {word} scope holds no marketplace checkout` and `the {word} scope holds no marketplace record`.
- `features/step_definitions/plugin/installation.steps.ts`: `the {word} scope holds no git clones`, `the {word} scope has no installed plugins`, `the {word} scope holds these git clones:`.
- `features/step_definitions/config.steps.ts`: `the {string} file of the {word} scope does not exist`.
- `features/marketplace/git-source.feature` and `features/plugin/git-source.feature`: the existing authentication-required rows (override-host form), the pinned two-plugin cache scenario, and the plugin git-source publishing steps.
- `features/lib/github-device-flow/server.ts` (frozen): fixed device code `stand-in-device-code`, user code `WDJB-MJHT`, token `stand-in-access-token`, interval 0; a poll past the script answers 500.

### Established Patterns
- `orchestrators/auth-host.ts::buildAuthForHost` returns a `stored-credential` bundle for a run that no command opened (`run.origin.kind !== "command"`), which is how the background pass (load-origin run, `background-pass.ts`) gets no Device Flow (D-PL8-12, D-3-04, AAP-02).
- `platform/git-auth-callbacks.ts::buildAuthCallbacks`: fill first, then Device Flow on a miss for a `device-flow` bundle; a Device Flow failure cancels, which classifies as `authentication required`.
- `domain/github-auth.ts::initiateDeviceFlow` approves the credential through `credentialOps.approve(host, cred)` only on success.

### Integration Points
- New verb module `features/step_definitions/marketplace/device-flow.steps.ts` (reserved for this phase); the sandbox HOME path comes from `world.tokens.home`, as `git-host.steps.ts` uses it.
- `npm run check:features` fails on an unused step, so every new step is used by a scenario in `device-flow.feature`.

</code_context>

<specifics>
## Specific Ideas

- The success criteria name the four observations: a user code and verification URL, then a clone, then no sign-in on the next command (DFLOW-01); authentication required and nothing left (DFLOW-02); the same flow on a cache miss and none on a hit (DFLOW-03); no device-code request from the background pass and stored credentials only (DFLOW-04).
- Each scenario's red proof (it fails without the behavior it names) is recorded in its plan SUMMARY, for example by breaking the behavior temporarily in an owned product file and showing the scenario fail.

</specifics>

<deferred>
## Deferred Ideas

- Device Flow in print mode (`DeviceFlowUnavailableError`) and a sign-in stand-in that fails its code request: not in DFLOW-01..04.
- GitLab's Device Flow: the stand-in serves GitHub's endpoints only.
- Claude Code reads `GITHUB_TOKEN`/`GH_TOKEN` for its background updates; this project uses stored credentials only (D-PL8-12). Not a bug a scenario exposes, so out of scope.

</deferred>
