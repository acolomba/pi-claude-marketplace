# Phase 1: Foundation - Context

**Gathered:** 2026-11-07
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the user asked for the recommended answer on every question, so each decision below is the recommendation, auto-accepted.

<domain>
## Phase Boundary

Phase 1 builds every shared stand-in, fixture writer, driver, and shared step that the fifteen stream phases (2-16) name, proves each one with a seed scenario placed in the feature file of the stream that will own it, then freezes every shared file. It also writes the cucumber layout rules for this milestone, the child-session brief, and the root dubious-choices log, runs the combined-tree gate, and creates the fifteen phase branches. It adds no coverage of its own beyond the seeds, and it changes product code only where a stand-in needs a seam that a decision below licenses.

</domain>

<decisions>
## Implementation Decisions

### Device Flow stand-in (D-BG-01, D-BG-02, D-BG-03)

- **D-BG-01 — how Pi reaches the stand-in: an in-process redirect, no product change.** A Device Flow scenario runs its own Pi (the world's per-scenario Pi, as `usePiWithGitHubBaseUrl` and `usePiWithProfile` do) WITHOUT `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, so GHB-02 does not turn Device Flow off, and with one extra harness Pi extension loaded through `--extension`, in the shape of the existing harness extensions (`features/lib/pi-registry-probe/extension.ts`, `builtin-mcp-stand-in/extension.ts`). At load, that extension redirects every request for `github.com` inside the Pi process: `globalThis.fetch` calls to `https://github.com/login/device/code` and `https://github.com/login/oauth/access_token` go to the loopback Device Flow stand-in, and the git transport's `https.request` calls for `github.com` go to the run's loopback git host. Any other request to a non-loopback host fails closed with an error that names it, so no request leaves the machine. Rationale: the roadmap prefers it, it keeps the product's real github.com path under test, and it follows the precedent of harness Pi extensions. Alternatives rejected: a product env-var seam for the Device Flow base URL (a test-only seam, which CONVENTIONS.md discourages, and it needs an NFR-5/NFR-10 review); amending GHB-02 so the override host also runs Device Flow (changes shipped behavior).
- **D-BG-02 — fallback if the redirect cannot reach the git transport.** If research shows that isomorphic-git's node transport (`isomorphic-git/http/node`, which goes through `simple-get`) cannot be redirected in-process, the planner may add the narrowest product seam instead: the Device Flow endpoints follow `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`'s origin (as GitHub Enterprise Server serves `/login/device/code` on its own host), recorded as an amendment of GHB-02 with this ID, an NFR-5 and NFR-10 check in the plan, and a `P1-DC` entry for the user's review. It does not stop the phase.
- **D-BG-03 — the stand-in itself.** A loopback HTTPS server in `features/lib/` (the same certificate approach as `features/lib/https-git-host/`) that issues a fixed device code and user code, answers each poll from a per-scenario script (`authorization_pending`, then authorized, `access_denied`, or `expired_token`), records every request with its form body, and issues a token that the run's git host accepts through its existing `credential` arm. It answers with the smallest polling interval the product honors; research checks the product for a floor, and the phase does not change the product to poll faster.
- A seed in `features/marketplace/device-flow.feature` proves a sign-in on a `marketplace add` of a private GitHub source: the user code reaches the user, the clone succeeds after the scripted authorization, and the stand-in's request log shows no request that left the loopback.

### Profiles and tags (D-BG-04, D-BG-05)

- **D-BG-04 — "passes under both profiles" means the whole `npm run test:cucumber` is green under both the `adapter` and the `builtin` profile.** A scenario with no MCP surface runs once, under the `adapter` profile, as DUAL-02 already defines; only a scenario with an MCP surface carries `@mcp` (runs under both) or an `@adapter-only`/`@builtin-only` pair. Phase 1 corrects the wording of the REQUIREMENTS.md preamble, FND-01, and the roadmap's milestone goal and Behavioral tests rule to say this. Rejected: tagging every new scenario `@mcp` so it runs twice (doubles the builtin leg's time for no extra signal, and misuses a tag that means "has an MCP surface").
- **D-BG-05 — seed tags.** A seed carries `@mcp` only when its stand-in has an MCP surface: the legacy `mcp.json` move seed (Phase 9) does; the others do not unless the planner finds one.

### Scripted model and Pi-driven events (D-BG-06 to D-BG-09)

- **D-BG-06 — a turn that ends in error.** The scripted model gains a script step kind that answers with an assistant message whose stop reason is `error` and whose error message the scenario chooses (the faux provider's `fauxAssistantMessage` options). Research confirms how Pi 1.5.0 surfaces it (the turn's end event and the error type a `StopFailure` matcher reads); if the faux path cannot produce the error types Claude Code's matchers name, the step reproduces the provider error Pi maps to them and the seed pins the type Pi reports.
- **D-BG-07 — an automatic compaction is Pi's own.** The scripted model gains a step kind (or a step option) that reports token usage above the compaction threshold of the scripted model's context window, so Pi starts its own compaction with trigger `auto`; the compaction's summary call is answered by the next script step. No harness code calls a compact API, because that would not be the automatic path. Research finds Pi 1.5.0's threshold rule and settings.
- **D-BG-08 — model-facing tools need no new driver unless the steps lack one.** The scripted model already calls any tool through its `tool` step kind and logs every call's messages. Phase 1 adds the shared steps that a scenario needs to read back the tool result the model received (in the next call's messages), in `model.steps.ts`, if they do not exist; the seed in `features/plugin/model-tools.feature` calls `pi_claude_marketplace_list` and reads its result.
- **D-BG-09 — a json-mode run of one command.** Phase 1 adds a one-shot driver that runs Pi in its json output mode with one `/claude:plugin` command and reads the result entries, beside the RPC driver (`features/lib/pi-commands.ts`) and the terminal driver (`features/lib/pi-tui.ts`), so a scenario can compare one command's outcome across modes. Research confirms Pi 1.5.0's json mode invocation. If Pi 1.5.0 has no such mode that runs a slash command, the seed compares the RPC and terminal outcomes only, BOOT-01's json clause becomes a `P1-DC` entry, and the requirement text is narrowed in the same commit as D-BG-04's wording fix.

### Process stand-ins and fixtures (D-BG-10 to D-BG-13)

- **D-BG-10 — the background child is a profile Pi with `PI_SUBAGENT_CHILD=1`.** That variable is exactly what the product reads (`platform/subagent-child.ts`, D-MB-12), so a profile Pi started with it in its environment exercises every product gate. No pi-subagents runner is involved. Research confirms nothing else in Pi or the companions changes behavior on that variable alone. Seed in `features/plugin/subagent-child.feature`.
- **D-BG-11 — a stale lock is a lock directory older than the product's stale window.** The product locks with `retries: 0, stale: 10_000` (`transaction/with-state-guard.ts`), and proper-lockfile reads a lock directory whose mtime is older than `stale` as free, with no process check. The fixture writer (in `features/lib/state-lock-holder.ts`) creates the scope's lock directory and sets its mtime well into the past; no process is killed and no scenario waits. A live holder stays the existing child-process holder. Seed in `features/marketplace/state-lock.feature`.
- **D-BG-12 — async hooks.** The hook recorder records each async hook run's start, exit code, and end; the hook fixtures declare `asyncRewake` hooks whose scripts can outlive their event (they wait on a marker the scenario controls) and exit with a chosen code. A rewake is observed where the user and the model see it: the scripted model's next call carries the injected message, and the `rewakeSummary` reaches the user's notifications. Seed in `features/hook/async.feature`.
- **D-BG-13 — earlier-release fixtures are real earlier shapes.** The fixture writers for an older-schema `state.json`, a newer-schema `state.json`, a scope with `state.json` and no `claude-plugins.json`, and a legacy `mcp.json` with a plugin's marked entries beside the user's own come from the persisted shapes in the repository's history (the schema at its last release before each migration), not invented shapes; each writer names the release or commit it reproduces. They extend `features/lib/earlier-version-state.ts` and the MCP configuration library. Seeds in `features/plugin/state-migration.feature`, `features/plugin/config-migration.feature`, and `features/mcp-server/legacy-move.feature`.

### Ownership, records, and branches (D-BG-14 to D-BG-16)

- **D-BG-14 — seeds live in the stream files, named as the roadmap's ownership table names them.** Phase 1 creates each new stream feature file holding only its seed, and adds a seed to each existing one (`plugin/{browse,prune,bootstrap}.feature`, `marketplace/state-lock.feature`) where the stream needs a new stand-in. `.agents/skills/cucumber/rules/layout.md` gains a "Behavioral gaps" section that copies the ownership table, reserves each stream's feature file and verb step module name, and lists the new stand-ins; `scripts/check-features.mjs` is changed only if a new file family needs it.
- **D-BG-15 — IDs.** Milestone decisions use `D-BG-NN` (this file starts the sequence; later phases continue it after reading the root log). Phase 1's dubious choices are `P1-DC-NN` in `.planning/phases/01-foundation/DUBIOUS-CHOICES.md`; the root log `.planning/DUBIOUS-CHOICES.md` is created by Phase 1 and written only by the parent.
- **D-BG-16 — the fifteen phase branches are local.** Phase 1 creates `features/behavioral-gaps-phase-2` to `-16` at the verified Phase 1 head as local branches, and does not push them or the milestone branch: the child sessions run on this machine, so the parent merges local branches. Pushing is left to the user. The child-session brief says so, and the roadmap's "commits and pushes only its own branch" rule is amended to "commits only to its own branch; pushes nothing unless the user asks".

### Claude's Discretion

- Library and step names for the new stand-ins, as long as they follow `layout.md`'s file families and naming rules.
- How the plans split across waves, within the roadmap's suggested structure (plans in one wave own disjoint files).
- Whether the CI behavioral timeouts need raising, from the measured run (D-CF1-16: at least 1.5 times the measured run, never below 15 minutes).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `features/lib/scripted-model/{extension,script}.ts`: the faux-provider model; step kinds `reply` and `tool`; every call logged with its messages; `callMessageRows` reads them back.
- `features/lib/https-git-host/{server,cgi}.ts`: loopback HTTPS git host with a `credential` arm (401 unless one user and password), a request log, and a CA trusted through `NODE_EXTRA_CA_CERTS`.
- `features/lib/state-lock-holder.ts`: a child process that holds a scope's state lock with the product's options until its stdin closes.
- `features/lib/earlier-version-state.ts`, `mcp-builtin-earlier-record.ts`, `mcp-agent-earlier-index.ts`: writers of earlier-release records.
- `features/lib/hook-recorder.ts`, `hook-files.ts`: hook run recording and hook fixtures.
- `features/lib/pi-tui.ts` + `pi-tui-pty.py`: a real-terminal Pi driver.
- `features/lib/pi-commands.ts`, `test/e2e/_rpc.ts`: the RPC driver (`--mode rpc`, `claude-plugin` custom entries).
- `features/support/world.ts`: `usePiWithGitHubBaseUrl`, `usePiWithBackgroundUpdateDelay`, `usePiWithProfile` start a per-scenario Pi with another environment or extensions.
- Harness Pi extensions loaded with `--extension`: `pi-registry-probe/`, `builtin-mcp-stand-in/`, `mcp-builtin-config-probe/`, `pi-launch-environment.ts`, `unreadable-namespace-tool.ts`.

### Established Patterns
- Stand-ins are loopback-only and record their requests; scenarios observe what Pi or the user sees (command results, registries, hook recorder, model call log, stand-in request logs, the terminal screen, user-edited files).
- `features/support/pi-process.ts` starts the run's shared Pi with `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL=https://<git host>`; GHB-02 (`orchestrators/auth-host.ts` `buildGitHubAuth`) makes that a stored-credential bundle with no Device Flow.
- `domain/github-auth.ts` posts to `https://github.com/login/device/code` and `/login/oauth/access_token` through global `fetch` (the one sanctioned caller, `fetch-chokepoint`).
- `transaction/with-state-guard.ts` locks with `retries: 0, stale: 10_000`.
- `cucumber.json`: `adapter` runs `not @builtin-only`; `builtin` runs `(@mcp or @builtin-only) and not @adapter-only`.

### Integration Points
- New harness extension(s) load through a world method that starts a per-scenario Pi with a profile; Phase 1 adds one that also drops the GitHub base override.
- New script step kinds are validated by `features/lib/scripted-model/script.ts`'s schema and played in `extension.ts`.
- New shared steps go into the frozen shared/topic step modules before the freeze; stream verb modules are reserved, not created, except where a seed needs a step only that stream will use (then the step goes in a shared or topic module, since streams own their verb modules).

</code_context>

<specifics>
## Specific Ideas

- The Device Flow seed must show, from the stand-in's request log, that no request left the loopback (success criterion 1).
- Every seed records a red proof in its plan SUMMARY: the seed fails when its stand-in or the product path it exercises is broken.
- The child-session brief follows `.planning/milestones/component-features-CHILD-SESSION-BRIEF.md`, updated for local branches (D-BG-16), this machine's environment, and this milestone's rules.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
