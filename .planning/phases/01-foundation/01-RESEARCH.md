# Phase 1: Foundation - Research

**Researched:** 2026-11-07
**Domain:** cucumber harness stand-ins for Pi 1.5.0 (faux provider, compaction, json mode, TUI, process env), proper-lockfile, GitHub Device Flow redirect, earlier-release fixtures
**Confidence:** HIGH for the code facts below (each read this session); MEDIUM for the in-Pi behavior of the redirect and the TUI picker reading (proven at the Node level only; the seeds are the proof)

## Summary

Every stand-in the fifteen streams need can be built inside `features/` and `test/e2e/_rpc.ts`, with no product change. The Device Flow redirect is feasible in-process: isomorphic-git's node client calls `simple-get`, which calls `require('https').request` on the module object at call time, so a harness Pi extension that replaces `https.request` (and `globalThis.fetch`) reroutes both the git transport and the Device Flow endpoints. A probe this session proved both entry points of `isomorphic-git/http/node` (ESM and CJS) go through a patched `https.request`, and that a patched `globalThis.fetch` intercepts `https://github.com/login/device/code`. So D-BG-02's fallback seam is not needed.

Three facts change how the planner must build the model stand-ins. (1) The faux core overwrites every scripted message's `usage` with its own estimate (`withUsageEstimate`), so D-BG-07's usage option must patch the final message after the faux core, by wrapping `streamSimple`. (2) With Pi's default `keepRecentTokens: 20000`, a short session has nothing to compact and `_runAutoCompaction` returns silently, so the automatic-compaction seed also needs the existing `pi keeps only one recent token when the hooks session compacts` Given. (3) Pi 1.5.0 has `--mode json`, but it exits when no model is selected and it reads stdin to the end first, so the json driver loads the scripted model, selects `faux/faux-1`, and closes stdin.

The background-child stand-in is a profile Pi whose spawn environment carries `PI_SUBAGENT_CHILD=1`. Pi, pi-mcp-adapter, and pi-dynamic-workflows never read that variable, but pi-subagents does: under it pi-subagents registers nothing. A real runner sets the variable before pi-subagents loads, so a spawn-environment child matches a real child, and the existing launch-environment approach (which sets it after pi-subagents loaded) does not. The stale lock is an empty `.state-lock` directory with an old mtime; proper-lockfile removes it and takes the lock on the first try with `retries: 0` and reports nothing. Measured CI legs on main (mcp-builtin merged) take 3-5.3 minutes against a 15-minute timeout, so the seeds need no timeout change.

**Primary recommendation:** Put every `world.ts` / `_rpc.ts` / `features/lib/pi-process.ts` launch change in one Wave 1 plan, so the Wave 2 stand-in plans own disjoint files; build the Device Flow stand-in as a loopback HTTPS server that reuses the git host's certificate plus a harness Pi extension that redirects `https.request`, `http.request`, and `globalThis.fetch` and fails closed for every other host.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Device Flow stand-in (D-BG-01, D-BG-02, D-BG-03)

- **D-BG-01 — how Pi reaches the stand-in: an in-process redirect, no product change.** A Device Flow scenario runs its own Pi (the world's per-scenario Pi, as `usePiWithGitHubBaseUrl` and `usePiWithProfile` do) WITHOUT `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, so GHB-02 does not turn Device Flow off, and with one extra harness Pi extension loaded through `--extension`, in the shape of the existing harness extensions (`features/lib/pi-registry-probe/extension.ts`, `builtin-mcp-stand-in/extension.ts`). At load, that extension redirects every request for `github.com` inside the Pi process: `globalThis.fetch` calls to `https://github.com/login/device/code` and `https://github.com/login/oauth/access_token` go to the loopback Device Flow stand-in, and the git transport's `https.request` calls for `github.com` go to the run's loopback git host. Any other request to a non-loopback host fails closed with an error that names it, so no request leaves the machine. Rationale: the roadmap prefers it, it keeps the product's real github.com path under test, and it follows the precedent of harness Pi extensions. Alternatives rejected: a product env-var seam for the Device Flow base URL (a test-only seam, which CONVENTIONS.md discourages, and it needs an NFR-5/NFR-10 review); amending GHB-02 so the override host also runs Device Flow (changes shipped behavior).
- **D-BG-02 — fallback if the redirect cannot reach the git transport.** If research shows that isomorphic-git's node transport (`isomorphic-git/http/node`, which goes through `simple-get`) cannot be redirected in-process, the planner may add the narrowest product seam instead: the Device Flow endpoints follow `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`'s origin (as GitHub Enterprise Server serves `/login/device/code` on its own host), recorded as an amendment of GHB-02 with this ID, an NFR-5 and NFR-10 check in the plan, and a `P1-DC` entry for the user's review. It does not stop the phase.
- **D-BG-03 — the stand-in itself.** A loopback HTTPS server in `features/lib/` (the same certificate approach as `features/lib/https-git-host/`) that issues a fixed device code and user code, answers each poll from a per-scenario script (`authorization_pending`, then authorized, `access_denied`, or `expired_token`), records every request with its form body, and issues a token that the run's git host accepts through its existing `credential` arm. It answers with the smallest polling interval the product honors; research checks the product for a floor, and the phase does not change the product to poll faster.
- A seed in `features/marketplace/device-flow.feature` proves a sign-in on a `marketplace add` of a private GitHub source: the user code reaches the user, the clone succeeds after the scripted authorization, and the stand-in's request log shows no request that left the loopback.

#### Profiles and tags (D-BG-04, D-BG-05)

- **D-BG-04 — "passes under both profiles" means the whole `npm run test:cucumber` is green under both the `adapter` and the `builtin` profile.** A scenario with no MCP surface runs once, under the `adapter` profile, as DUAL-02 already defines; only a scenario with an MCP surface carries `@mcp` (runs under both) or an `@adapter-only`/`@builtin-only` pair. Phase 1 corrects the wording of the REQUIREMENTS.md preamble, FND-01, and the roadmap's milestone goal and Behavioral tests rule to say this. Rejected: tagging every new scenario `@mcp` so it runs twice (doubles the builtin leg's time for no extra signal, and misuses a tag that means "has an MCP surface").
- **D-BG-05 — seed tags.** A seed carries `@mcp` only when its stand-in has an MCP surface: the legacy `mcp.json` move seed (Phase 9) does; the others do not unless the planner finds one.

#### Scripted model and Pi-driven events (D-BG-06 to D-BG-09)

- **D-BG-06 — a turn that ends in error.** The scripted model gains a script step kind that answers with an assistant message whose stop reason is `error` and whose error message the scenario chooses (the faux provider's `fauxAssistantMessage` options). Research confirms how Pi 1.5.0 surfaces it (the turn's end event and the error type a `StopFailure` matcher reads); if the faux path cannot produce the error types Claude Code's matchers name, the step reproduces the provider error Pi maps to them and the seed pins the type Pi reports.
- **D-BG-07 — an automatic compaction is Pi's own.** The scripted model gains a step kind (or a step option) that reports token usage above the compaction threshold of the scripted model's context window, so Pi starts its own compaction with trigger `auto`; the compaction's summary call is answered by the next script step. No harness code calls a compact API, because that would not be the automatic path. Research finds Pi 1.5.0's threshold rule and settings.
- **D-BG-08 — model-facing tools need no new driver unless the steps lack one.** The scripted model already calls any tool through its `tool` step kind and logs every call's messages. Phase 1 adds the shared steps that a scenario needs to read back the tool result the model received (in the next call's messages), in `model.steps.ts`, if they do not exist; the seed in `features/plugin/model-tools.feature` calls `pi_claude_marketplace_list` and reads its result.
- **D-BG-09 — a json-mode run of one command.** Phase 1 adds a one-shot driver that runs Pi in its json output mode with one `/claude:plugin` command and reads the result entries, beside the RPC driver (`features/lib/pi-commands.ts`) and the terminal driver (`features/lib/pi-tui.ts`), so a scenario can compare one command's outcome across modes. Research confirms Pi 1.5.0's json mode invocation. If Pi 1.5.0 has no such mode that runs a slash command, the seed compares the RPC and terminal outcomes only, BOOT-01's json clause becomes a `P1-DC` entry, and the requirement text is narrowed in the same commit as D-BG-04's wording fix.

#### Process stand-ins and fixtures (D-BG-10 to D-BG-13)

- **D-BG-10 — the background child is a profile Pi with `PI_SUBAGENT_CHILD=1`.** That variable is exactly what the product reads (`platform/subagent-child.ts`, D-MB-12), so a profile Pi started with it in its environment exercises every product gate. No pi-subagents runner is involved. Research confirms nothing else in Pi or the companions changes behavior on that variable alone. Seed in `features/plugin/subagent-child.feature`.
- **D-BG-11 — a stale lock is a lock directory older than the product's stale window.** The product locks with `retries: 0, stale: 10_000` (`transaction/with-state-guard.ts`), and proper-lockfile reads a lock directory whose mtime is older than `stale` as free, with no process check. The fixture writer (in `features/lib/state-lock-holder.ts`) creates the scope's lock directory and sets its mtime well into the past; no process is killed and no scenario waits. A live holder stays the existing child-process holder. Seed in `features/marketplace/state-lock.feature`.
- **D-BG-12 — async hooks.** The hook recorder records each async hook run's start, exit code, and end; the hook fixtures declare `asyncRewake` hooks whose scripts can outlive their event (they wait on a marker the scenario controls) and exit with a chosen code. A rewake is observed where the user and the model see it: the scripted model's next call carries the injected message, and the `rewakeSummary` reaches the user's notifications. Seed in `features/hook/async.feature`.
- **D-BG-13 — earlier-release fixtures are real earlier shapes.** The fixture writers for an older-schema `state.json`, a newer-schema `state.json`, a scope with `state.json` and no `claude-plugins.json`, and a legacy `mcp.json` with a plugin's marked entries beside the user's own come from the persisted shapes in the repository's history (the schema at its last release before each migration), not invented shapes; each writer names the release or commit it reproduces. They extend `features/lib/earlier-version-state.ts` and the MCP configuration library. Seeds in `features/plugin/state-migration.feature`, `features/plugin/config-migration.feature`, and `features/mcp-server/legacy-move.feature`.

#### Ownership, records, and branches (D-BG-14 to D-BG-16)

- **D-BG-14 — seeds live in the stream files, named as the roadmap's ownership table names them.** Phase 1 creates each new stream feature file holding only its seed, and adds a seed to each existing one (`plugin/{browse,prune,bootstrap}.feature`, `marketplace/state-lock.feature`) where the stream needs a new stand-in. `.agents/skills/cucumber/rules/layout.md` gains a "Behavioral gaps" section that copies the ownership table, reserves each stream's feature file and verb step module name, and lists the new stand-ins; `scripts/check-features.mjs` is changed only if a new file family needs it.
- **D-BG-15 — IDs.** Milestone decisions use `D-BG-NN` (this file starts the sequence; later phases continue it after reading the root log). Phase 1's dubious choices are `P1-DC-NN` in `.planning/phases/01-foundation/DUBIOUS-CHOICES.md`; the root log `.planning/DUBIOUS-CHOICES.md` is created by Phase 1 and written only by the parent.
- **D-BG-16 — the fifteen phase branches are local.** Phase 1 creates `features/behavioral-gaps-phase-2` to `-16` at the verified Phase 1 head as local branches, and does not push them or the milestone branch: the child sessions run on this machine, so the parent merges local branches. Pushing is left to the user. The child-session brief says so, and the roadmap's "commits and pushes only its own branch" rule is amended to "commits only to its own branch; pushes nothing unless the user asks".

### Claude's Discretion

- Library and step names for the new stand-ins, as long as they follow `layout.md`'s file families and naming rules.
- How the plans split across waves, within the roadmap's suggested structure (plans in one wave own disjoint files).
- Whether the CI behavioral timeouts need raising, from the measured run (D-CF1-16: at least 1.5 times the measured run, never below 15 minutes).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | The shared harness provides every stand-in, fixture writer, and shared step the stream phases name, each proven by a seed scenario under both profiles. | Sections "Stand-in designs" 1-10 give the mechanism, the file each lands in, and the seed for every Builds item; "Validation Architecture" maps each to a command and a red proof. D-BG-04 reading: "under both profiles" = whole `npm run test:cucumber` green under `adapter` and `builtin`. |
| FND-02 | Before the streams fork, the foundation files are listed as frozen in the roadmap, a child-session brief exists, and the combined tree passes `npm run check`. | "Recommended plan split" Wave 3; "CI time" (measured legs, no timeout change expected); "Frozen-file record" in Validation Architecture; branch creation commands under D-BG-16. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md and project skills)

- Never commit to `main`; never rebase or rewrite history; merge to update branches. Phase branches are `features/behavioral-gaps-phase-N` (allowed `features/*` family). [VERIFIED: /home/acolomba/pi-claude-marketplace/AGENTS.md "Git"]
- Commits follow `.agents/skills/committing/SKILL.md`; never `--no-verify`. Commit titles carry no milestone/phase/plan/wave/task identifier (ROADMAP Milestone rules).
- Every plan `SUMMARY.md` has a `## Threat Flags` section (AGENTS.md "GSD records"); WINDOWS descriptions are prefixed `[behavioral-gaps]`.
- Gates run `npm run check` on the combined tree (wave gate, phase gate); the pre-commit `check:commit` is not a gate (AGENTS.md "Build verification", `.agents/skills/local-verification/SKILL.md`). `npm run check` includes `check:features`, both cucumber profiles, fallow, lint over `features/`, and direct coverage. [VERIFIED: package.json:92-119]
- A user-visible `/claude:plugin` change ships with a cucumber scenario that fails without it (AGENTS.md "Behavioral tests"). Phase 1 changes no product behavior, so this applies only if a seed exposes a bug.
- Upstream parity: Claude Code behavior is the default; a divergence needs a recorded ID or a Pi gap (AGENTS.md "Constraints").
- Cucumber rules (`.agents/skills/cucumber/**`): feature title = `<Function> <capability>` of its path; steps lower case, `Given`/`When`/`Then` only, no `Given` after `When`; whole-value comparisons; stand-ins loopback-only, logging to `{home}/harness/<name>.jsonl`, pid files `<name>-<pid>.pid`; libraries register nothing; no module-level state except the run's Pi; a Pi extension under `features/lib/` carries `// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.`; upstream text is reduced through `features/lib/upstream/`; no new `features/support/` or `features/lib/` file after Phase 1. [VERIFIED: .agents/skills/cucumber/rules/*.md read this session]
- Subagent tests must use a hermetic home; never touch the real `~/.pi/agent` (user memory "Subagent tests must use hermetic home"). All cucumber Pis run in the run's sandbox (`rpcChildEnvironment` sets `HOME`, `PI_CODING_AGENT_DIR`). [VERIFIED: test/e2e/_rpc.ts:221-230]
- TypeScript style/comment policy: comments cite durable IDs (`D-BG-NN`), never phase/plan numbers (CONVENTIONS.md "Comments").

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Turn-error and usage script steps | Harness: scripted-model Pi extension (`features/lib/scripted-model/`) | Pi agent session (retry, compaction) | Pi decides what an error or usage triggers; the harness only shapes the provider answer |
| Automatic compaction | Pi agent session (`_checkCompaction`) | Harness settings Given (`keepRecentTokens`) | D-BG-07: no harness compact call |
| Device Flow redirect | Harness Pi extension (in-process `https`/`fetch` patch) | Loopback HTTPS stand-in + run's git host | D-BG-01: product's real github.com path stays under test |
| Background child | Harness launch environment (`_rpc.ts` allowlist) | Product gates (`load.ts`, `agent-grants-step.ts`) | D-BG-10 |
| Stale lock | Fixture writer (`state-lock-holder.ts`) | proper-lockfile inside the product | Product owns lock policy |
| json-mode run | Harness driver (`_rpc.ts` args + new lib) | Pi print-mode | Pi owns the mode; extension's JSON strategy appends entries |
| Picker driving | Harness TUI driver (`pi-tui.ts` + PTY bridge) | Product picker (`edge/browser/plugin-browser.ts`) | Real terminal only |
| Earlier-release state | Fixture writers (`earlier-version-state.ts`, MCP config lib) | Product migrations | D-BG-13: shapes from git history |
| Async hook lifecycle | Hook fixture scripts + recorder | Product async-rewake registry | Records start/exit/end where the product cannot |

## Standard Stack

No new packages. Everything uses what the repository already has.

### Core (already installed)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@earendil-works/pi-coding-agent` | 1.5.0 | Pi under test (rpc, json, tui modes) | [VERIFIED: node_modules package.json] |
| `@earendil-works/pi-ai` | 1.5.0 | faux provider (`createFauxCore`, `fauxAssistantMessage`), `createAssistantMessageEventStream` | [VERIFIED: node_modules/@earendil-works/pi-ai/dist/index.d.ts:24 exports `./utils/event-stream.ts`] |
| `isomorphic-git` | 1.44.5 | product git transport (`http/node` → `simple-get` 4.0.1) | [VERIFIED: node_modules package.json files] |
| `proper-lockfile` | 4.1.2 | product state lock; fixture holder | [VERIFIED: node_modules/proper-lockfile/package.json] |
| `@cucumber/cucumber`, `typebox` | repo pins | steps, script/record validation | existing |
| `openssl` CLI | 4.1.0 local | git host certificate (reused by Device Flow stand-in) | [VERIFIED: `openssl version`] |
| `python3` | 3.15.2 local | PTY bridge `pi-tui-pty.py` (stdlib only) | [VERIFIED: `python3 --version`] |

**Installation:** none.

## Package Legitimacy Audit

Phase 1 installs no external packages. No registry check applies.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Research Findings by Question

### Q1. Turn error (D-BG-06)

- `fauxAssistantMessage(content, options)` accepts exactly these options: `stopReason?: AssistantMessage["stopReason"]; deferred?: DeferredHandle; errorMessage?: string; responseId?: string; timestamp?: number;` [VERIFIED: node_modules/@earendil-works/pi-ai/dist/providers/faux.d.ts:24-30]. `errorMessage` is copied onto the message only when set [VERIFIED: faux.js:40-54].
- A message with `stopReason` `"error"` or `"aborted"` is streamed as `stream.push({ type: "error", reason: message.stopReason, error: message }); stream.end(message);` [VERIFIED: faux.js:310-314]. A throw inside the response factory becomes `createErrorMessage(error, ...)` with `stopReason: "error"` and `errorMessage: error.message` [VERIFIED: faux.js:205-217, 395-398] — that is how the script's overflow already fails a call (`features/lib/scripted-model/extension.ts:138-142`).
- **Where the bridge reads it:** `agent_end` caches the last assistant message (`agentEndCacheHandler`), `agent_settled` dispatches on its `stopReason`: `case "error": case "length":` → `classifyStopFailure(last.errorMessage ?? "", last.stopReason)` → `runStopFailure(...)` [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/settle.ts:108-120, 163-181]. Pi emits `agent_settled` after the post-run step [VERIFIED: agent-session.js:1469-1489] with `aborted = this._agentRunAbortRequested` [VERIFIED: agent-session.js:700-703], so an error turn settles with `aborted: false` and `the user prompts {string}` accepts it (it asserts `settled.aborted === false`) [VERIFIED: features/step_definitions/session.steps.ts:109-116].
- **Error types and their source:** the closed set is `"rate_limit", "overloaded", "authentication_failed", "oauth_org_not_allowed", "billing_error", "invalid_request", "model_not_found", "server_error", "max_output_tokens", "unknown"` [VERIFIED: extensions/pi-claude-marketplace/domain/components/hook-events.ts:207-217]. They come only from `errorMessage` substrings plus `stopReason "length" → max_output_tokens` [VERIFIED: bridges/hooks/payloads/stop-failure.ts:109-140, 159-175]. Table (verbatim matchers): `billing_error`: `"billing", "quota exceeded", "insufficient_quota", "usage limit", "available balance", "out of budget"`; `rate_limit`: `"rate limit", /\b429\b/, "too many requests"`; `overloaded`: `"overloaded", /\b529\b/`; `authentication_failed`: `"authentication failed", /\b401\b/, /\b403\b/`; `server_error`: `/\b500\b/, /\b502\b/, /\b503\b/, /\b504\b/, "server error", "internal error", "service unavailable"`; `model_not_found`: `"model not found", "model_not_found"`; `invalid_request`: `"invalid request", /\b400\b/`.
- **Can the faux path produce each type?** Yes for eight of ten by choosing `errorMessage`; `max_output_tokens` needs a step with `stopReason: "length"` (the faux core streams it as `done`) [VERIFIED: faux.js:315]; `oauth_org_not_allowed` has no matcher in the product table ("intentionally absent", stop-failure.ts:99-101), so no message produces it — that is a product classification fact, not a faux limit. So the step kind needs two options: an error message, and the stop reason (`error` default, `length` optional).
- **Auto retry:** Pi retries when `isRetryableAssistantError(message)` (stopReason `error`, a `RETRYABLE_PROVIDER_ERROR_PATTERN` match such as `overloaded`, `rate.?limit`, `429|500|502|503|504|520|524`, `server.?error`, `internal.?error`, and no `NON_RETRYABLE` match such as `billing`, `quota exceeded`) [VERIFIED: node_modules/@earendil-works/pi-ai/dist/utils/retry.js:4-60, 205-213] and retry is enabled (default `retry: { enabled: true, maxRetries: 3, baseDelayMs: 2000` [VERIFIED: pi-coding-agent/dist/core/settings-defaults.js:17-21]; `_prepareRetry` returns false when `!settings.enabled` [VERIFIED: agent-session.js:3108-3112]). The profile Pi turns it off: `await this.expectSuccess({ type: "set_auto_retry", enabled: false });` [VERIFIED: features/support/world.ts:954]. So in a profile Pi, one error step = one model call. **A terminal (TUI) Pi does not turn retry off**, so an error step in a TUI turn would be retried up to 3 times with 2 s+ backoff.
- **Two side paths that consume extra script steps:** (a) an `errorMessage` matching Pi's `OVERFLOW_PATTERNS` (`/prompt (?:is )?too long/i`, `/context[_ ]length[_ ]exceeded/i`, `/too many tokens/i`, `/token limit exceeded/i`, a leading `413`, …) is an explicit context overflow: Pi compacts with reason `overflow` and retries [VERIFIED: pi-ai/dist/utils/overflow.js:37-67, 139-152; agent-session.js:2451-2491]; (b) `stopReason "length"` with output below `maxTokens` (16384 for `faux-1`) is `isRecoverableLength` → the same compact-and-retry path [VERIFIED: overflow.js:177-179; agent-session.js:2455-2491; faux.js:337-338]. With the default `keepRecentTokens` a one-turn session has nothing to compact, so `_runAutoCompaction` returns false and no extra call happens; with `keepRecentTokens: 1` it does compact and retry. Seeds should use a non-retryable, non-overflow message (e.g. `Authentication failed (401)`).

### Q2. Automatic compaction (D-BG-07)

- Threshold rule: `return contextTokens > contextWindow - settings.reserveTokens;` [VERIFIED: pi-coding-agent/dist/core/compaction/compaction.js:173-177]. Defaults `enabled: true, reserveTokens: 16384, keepRecentTokens: 20000` [VERIFIED: compaction.js:53-57; settings-defaults.js:8-12]. `faux-1` has `contextWindow: 128000, maxTokens: 16384` [VERIFIED: faux.js:337-338]. So the threshold is 111616 tokens.
- `contextTokens` for a normal (`stop`) reply is `calculateContextTokens(assistantMessage.usage)` = `usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite` [VERIFIED: compaction.js:65-67; agent-session.js:2505-2527]. The check runs in `_handlePostAgentRun` → `_checkCompaction(message)` → `_runAutoCompaction("threshold", false)`, before `agent_settled` [VERIFIED: agent-session.js:1549-1580, 2524-2525, 1469-1489].
- Settings keys: `compaction.enabled`, `compaction.reserveTokens`, `compaction.keepRecentTokens`, and per-model `compaction.modelOverrides["<provider>/<id>"].<field>` [VERIFIED: core/settings-manager.js:654-685].
- **Pitfall 1 (usage is overwritten):** the faux core always replaces a scripted message's `usage` with its estimate: `resolveResponse` returns `withUsageEstimate(cloneMessage(resolved, ...), ...)`, and `withUsageEstimate` returns `{ ...message, usage: { input, output: outputTokens, cacheRead, cacheWrite, totalTokens: ..., cost: ... } }` [VERIFIED: faux.js:134-168, 354-357]. A usage option on a `fauxAssistantMessage` never reaches Pi. The step option must patch the final message after the faux core: wrap `faux.streamSimple` in `scripted-model/extension.ts`, re-push each event, and replace `usage` on the `done` event's `message` and on the `end(message)` result (`createAssistantMessageEventStream` is exported from `@earendil-works/pi-ai`; `EventStream.push/end/result` [VERIFIED: pi-ai/dist/utils/event-stream.js:19-80]).
- **Pitfall 2 (silent no-op):** `_runAutoCompaction` calls `prepareCompaction(pathEntries, settings)` and returns false when it is undefined, before `compaction_start` [VERIFIED: agent-session.js:2537-2551]. `prepareCompaction` returns undefined when nothing precedes the kept tail [VERIFIED: compaction.js:609-643]; with `keepRecentTokens: 20000` a short scripted session keeps everything. The existing Given `pi keeps only one recent token when the hooks session compacts` writes `{"compaction":{"keepRecentTokens":1}}` to the agent settings before the profile Pi starts [VERIFIED: features/step_definitions/hook/session.steps.ts:44-46]. The automatic-compaction seed reuses it.
- **Pitfall 3 (overflow vs threshold):** a `stop` reply whose `usage.input + usage.cacheRead > contextWindow` is a "silent overflow" → reason `overflow`, not `threshold` [VERIFIED: overflow.js:153-160; agent-session.js:2451-2462]. Both map to trigger `auto`, but to pin the threshold path choose `input` ≤ 128000 and `totalTokens` > 111616 (e.g. `input: 120000`, `totalTokens: 120000`).
- **The summary call:** `_runAutoCompaction` (no extension override) calls `_runDefaultCompaction(preparation, model, ...)`, which runs the model, so the scripted model answers it with the next script step; it emits `session_compact` with `reason` [VERIFIED: agent-session.js:2595-2617]. With `keepRecentTokens: 1` the existing manual seed shows one summarization reply and a summary of `No prior history.\n\n---\n\n**Turn Context (split turn):**\n\nSummary A.` [VERIFIED: features/hook/session.feature:89]. The summarization call's messages carry Pi's own prompt text (upstream text), so the seed compares the hook runs, not that call's rows.
- **What the hook path reads:** `SessionCompactEvent.reason: "manual" | "threshold" | "overflow"` [VERIFIED: pi-coding-agent/dist/core/extensions/types.d.ts:632-640]; `compactTrigger(reason)` returns `reason === "manual" ? "manual" : "auto"` [VERIFIED: bridges/hooks/payloads/compact-trigger.ts:11-13]; `translatePostCompact` emits `trigger: compactTrigger(event.reason)` and `compact_summary: event.compactionEntry.summary` [VERIFIED: bridges/hooks/payloads/post-compact.ts:26-38].
- **Adding the step kind/option:** script steps are a typebox union validated by `SCRIPT_VALIDATOR` and parsed from table columns `reply`, `tool`, `arguments` (`SCRIPT_COLUMNS`) [VERIFIED: features/lib/scripted-model/script.ts:21-39, 56, 68-119]; the player maps a step to a message in `playNextStep` [VERIFIED: extension.ts:125-153]. New columns (recommended names): `error` (the error message; implies stop reason `error`), `stop reason` (`length` only, with `error` empty), and `context tokens` (an integer that becomes `usage.input`/`usage.totalTokens` on a `reply` step). Each is optional, so every existing table stays valid; `checkScriptHeader` must accept them and still demand `reply` as it does today, or relax the "no reply column" rule for an error-only table.

### Q3. Background child (D-BG-10)

- **Readers of `PI_SUBAGENT_CHILD`** (grep across `extensions/`, `features/`, `test/`, `scripts/`, `node_modules/@earendil-works/`, and the optional-peer cache at `/home/acolomba/pi-claude-marketplace/node_modules/.cache/optional-peers/node_modules/`; this worktree has no peer cache yet):
  - Product: `const SUBAGENT_CHILD_VARIABLE = "PI_SUBAGENT_CHILD";` and `return env[SUBAGENT_CHILD_VARIABLE] === "1";` [VERIFIED: platform/subagent-child.ts:19, 28-30]. Callers: `createLoadReconcile(..., env: SubagentChildEnv = process.env)` with `if (isSubagentChild(env)) { await readOnlyPass(reader, SCOPES, { ...opts, migrateMcpEntries: NO_MCP_MOVE }); return; }` [VERIFIED: orchestrators/reconcile/load.ts:238-250]; `agentGrantsStep` returns when `isSubagentChild(env) || active === "none"` [VERIFIED: orchestrators/mcp/agent-grants-step.ts:76-83], bound to `process.env` at call time in `index.ts:130`. No other product caller.
  - Pi 1.5.0 (`@earendil-works/*`): no occurrence.
  - pi-mcp-adapter 7.0.0, pi-dynamic-workflows 3.15.0: no occurrence.
  - **pi-subagents 0.84.0 does change behavior:** `process.env.PI_SUBAGENT_CHILD === "1" ? undefined : (await import("./src/extension/index.js")).default` — under the variable it registers nothing [CITED: optional-peers/node_modules/pi-subagents/index.js:3-7; bundle/index.js:20]; also `src/extension/index.js:225` and `:919`, and `doctor.js:153`. The runner sets the variable before child sessions start: `process.env[SUBAGENT_CHILD_ENV] = "1";` [CITED: pi-subagents/src/runs/background/subagent-runner.js:89].
- **Confirmation:** a profile Pi spawned with the variable in its environment hits both product gates, because both read `process.env` when the event runs. It also makes pi-subagents inert if the profile loads it, which is what a real runner child gets. The existing step `pi runs with the scripted model and pi-subagents as a pi-subagents background child` sets the variable through the launch-environment extension, after pi-subagents loaded, so pi-subagents registers its tools there (its own comment says so) [VERIFIED: features/step_definitions/mcp-server/agent-grants.steps.ts:100-125]. That is less faithful; D-BG-10's "started with it in its environment" needs the spawn environment.
- **Plumbing gap:** the allowlist has no slot for it: `rpcChildEnvironment` sets only `HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH`, the git keys, and the profile's `TMPDIR` [VERIFIED: test/e2e/_rpc.ts:221-247]. Add an optional `PI_SUBAGENT_CHILD?: "1"` to `RpcProfileEnvironment` and a `PiProfile` option in `world.ts`.

### Q4. Stale lock (D-BG-11)

- Product: `lockfile.lock(locations.extensionRoot, { lockfilePath: locations.stateLockFile, realpath: false, retries: 0, stale: 10_000, update: 2_000, onCompromised: ... })` [VERIFIED: transaction/with-state-guard.ts:212-223]; `const stateLockFile = path.join(extensionRoot, ".state-lock");` with `extensionRoot = path.join(scopeRoot, "pi-claude-marketplace")` [VERIFIED: persistence/locations.ts:221-224]. The lock directory is `<scopeRoot>/pi-claude-marketplace/.state-lock` (`{agent dir}/…` for user, `{project dir}/.pi/…` for project).
- proper-lockfile 4.1.2: `mkdir(lockfilePath)`; on `EEXIST`, `stat` it; `if (!isLockStale(stat, options))` → `ELOCKED`; else `removeLock` (an `rmdir`, so the directory must be empty) and `acquireLock(file, { ...options, stale: 0 }, callback)` [VERIFIED: node_modules/proper-lockfile/lib/lockfile.js:25-82, 88-97]. `isLockStale` is `stat.mtime.getTime() < Date.now() - options.stale` [VERIFIED: lockfile.js:84-86]; `options.stale = Math.max(options.stale || 0, 2000);` [VERIFIED: lockfile.js:219]. No pid or process check. So an empty `.state-lock` directory with mtime older than 10 s is taken on the first and only attempt, with no wait and no retry.
- The product reports nothing about a takeover: only `ELOCKED` becomes `StateLockHeldError`; any other error is rethrown as is [VERIFIED: with-state-guard.ts:224-231, 247-254]. A non-empty stale directory would fail `rmdir` with `ENOTEMPTY`, which the product would surface as a generic error, not "lock held" — the fixture must leave it empty.
- Existing live holder: `holdStateLock(extensionRoot, lockFile)` spawns a child that takes the lock with the product's options and keeps it fresh until stdin closes; `isStateLockHeld` uses `lockfile.check(..., stale: 10_000)` [VERIFIED: features/lib/state-lock-holder.ts:56-109]; step `another process holds the state lock of the {word} scope` [VERIFIED: features/step_definitions/scope-state.steps.ts:15-23]. The new writer goes beside it: `mkdir(lockFile)` then `utimes(lockFile, past, past)`, asserting afterwards that `isStateLockHeld` is false (proper-lockfile's own reading).

### Q5. Device Flow (D-BG-01..03)

**(a) Product flow**
- Requests: `POST https://github.com/login/device/code` with form body `client_id=<id>&scope=repo`, headers `Accept: application/json`, `Content-Type: application/x-www-form-urlencoded`; `POST https://github.com/login/oauth/access_token` with `client_id`, `device_code`, `grant_type=urn:ietf:params:oauth:grant-type:device_code` [VERIFIED: domain/github-auth.ts:172-185, 209-230]. Provider: `deviceCodeUrl: "https://github.com/login/device/code"`, `tokenUrl: "https://github.com/login/oauth/access_token"`, `clientId: "Ov23liNcyK08uGdU0mMl"`, `scope: "repo"`, `credentialFrom: (accessToken) => ({ username: "x-access-token", password: accessToken })` [VERIFIED: domain/auth-registry.ts:50-61].
- The device-code response must carry `device_code`, `user_code`, `verification_uri` (strings), `expires_in`, `interval` (numbers), else `TypeError("Device code response missing required fields")` [VERIFIED: github-auth.ts:195-206].
- Polling: `let currentIntervalSec = deviceCode.interval;` then each loop `await (opts.waitForPoll ?? waitForPoll)(currentIntervalSec * 1000, opts.signal);` [VERIFIED: github-auth.ts:339-346]. **No floor:** an `interval` of `0` polls with no wait. `slow_down` adds 5 s cumulatively (`currentIntervalSec += 5;`) [VERIFIED: github-auth.ts:369-372], so a stand-in script must not use it in a fast seed. Outcomes: `authorization_pending` → poll again; `access_denied` → reason `User cancelled authorization. Run the command again to retry.`; `expired_token` → `Device code expired before authorization. Run the command again to restart.`; deadline `expires_in` → timed-out reason [VERIFIED: github-auth.ts:358-399]. The poll body's `error` field is read even on HTTP 200 [VERIFIED: github-auth.ts:238-283].
- The user code reaches the user once, before polling: `opts.onDeviceCode({ verificationUri: deviceCode.verification_uri, userCode: deviceCode.user_code })` [VERIFIED: github-auth.ts:418-423] → `notifyDeviceFlowPrompt` emits a `device-flow-prompt` surface with `verificationUri` and `userCode` [VERIFIED: shared/notification-dispatch.ts:369-383]; over RPC/json it is a `claude-plugin` entry like any payload.
- Success: `const cred = provider.credentialFrom(r.accessToken); await opts.credentialOps.approve(opts.host, cred); return { ok: true, cred };` [VERIFIED: github-auth.ts:359-364] — `git credential approve` for host `github.com`, user `x-access-token`. The git host's credential arm compares `Authorization: Basic base64(user:password)` [VERIFIED: features/lib/https-git-host/server.ts:263-270], so arm it with `x-access-token` and the stand-in's fixed token.
- Gates that must pass for the flow to run: GHB-02 — `if (overrideHost !== undefined) return buildStoredCredentialAuth(overrideHost, ...)` [VERIFIED: orchestrators/auth-host.ts:225-238]; a run not opened by a command gets stored credentials only (`provider === undefined || run.origin.kind !== "command"`) [VERIFIED: auth-host.ts:182-188]; print mode throws `DeviceFlowUnavailableError` [VERIFIED: auth-host.ts:197-199]. RPC mode (`ctx.mode === "rpc"`) runs it.
- "The next command needs no sign-in" (DFLOW-01) needs a credential helper: Pi's git reads `GIT_CONFIG_GLOBAL = {home}/.gitconfig` [VERIFIED: features/support/pi-process.ts:149-153], and the existing step writes `[credential]\n\thelper = store\n` only together with a pre-stored credential [VERIFIED: features/step_definitions/git-host.steps.ts:168-187]. Phase 1 adds a step that writes the helper config alone (e.g. `the user's git keeps credentials in its credential store`), so `approve` stores to `{home}/.git-credentials` and the next `fill` finds it.

**(b) In-process redirect feasibility**
- `platform/git.ts` sends every hop through `nodeHttpClient.request({ ...hop, fetchOptions: { followRedirects: false } })` from `isomorphic-git/http/node` [VERIFIED: platform/git.ts:5-6, 307]. That client calls `get({ ...fetchOptions, url, method, headers, agent, body, signal })` from `simple-get` [VERIFIED: node_modules/isomorphic-git/http/node/index.js:186-213]; `simple-get` does `const https = require('https')` at module top and `const protocol = opts.protocol === 'https:' ? https : http; const req = protocol.request(opts, ...)` at call time, with `hostname`/`port`/`path` from `url.parse` [VERIFIED: node_modules/simple-get/index.js:6-7, 17-23, 48-49].
- **Probe (this session):** a Node 26 script replaced `https.request` on the `node:https` default export, then called `request()` of both `isomorphic-git/http/node` entries (ESM `index.js` and CJS via `require`). Output: `esm: redirected github.com/acme/tools.git/info/refs?service=git-upload-pack`, `cjs: redirected github.com/acme/tools.git/info/refs?service=git-upload-pack`, recorded options `{"hostname":"github.com","port":null,"path":"/acme/tools.git/info/refs?service=git-upload-pack","method":"GET"}`; a patched `globalThis.fetch` printed `fetch intercepted: https://github.com/login/device/code`. [VERIFIED: probe /tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/probe/https-probe.mjs]. Not yet proven inside Pi's jiti realm; the builtin module object and `globalThis` are process-wide, so it is expected to hold [ASSUMED], and the seed is the proof.
- The product's fetch call sites use the bare global `fetch(...)` at call time [VERIFIED: github-auth.ts:178, 223], so a replacement installed in the harness extension's factory (which runs after the real extension's factory but before any command) is seen.
- **Redirect rule:** for an `https.request` whose `hostname` is `github.com`, call the original with `hostname: "127.0.0.1"`, `port: <git host port>` (TLS then verifies against `127.0.0.1`, which the git host certificate covers, as every `{git host}` scenario proves). For `fetch` of `https://github.com/login/…`, rewrite the URL to the Device Flow stand-in. For every other non-loopback hostname on `https.request`, `http.request`, or `fetch`, throw an error naming the host and log a refusal line. Patch `https.get`/`http.get` too, because Node's `get` does not go through the exported `request` [ASSUMED].
- **Certificate:** Pi trusts exactly one extra CA file, `NODE_EXTRA_CA_CERTS: gitHost.certificatePath` [VERIFIED: features/support/pi-process.ts:147-150]; the git host makes a one-day self-signed P-256 certificate for `127.0.0.1` with `openssl` at start [VERIFIED: features/lib/https-git-host/server.ts:40-52, 366-379]. A Device Flow server with its own new certificate would not be trusted. **Recommendation:** the stand-in reuses the git host's `key.pem` and `cert.pem` (add a read-only key path accessor to `HttpsGitHost`, which already exposes `certificatePath`), so "the same certificate approach" holds with one CA file.
- **Address hand-off:** the redirect extension reads the git host port and the stand-in port from a JSON file the step writes to `{home}/harness/` before Pi starts (precedent: `pi-launch-environment.json`, and the built-in stand-in's config). It logs every intercepted request (`github-redirect.jsonl`: original URL, routed-to, or refused) — this log, not the stand-in's, proves "no request left the machine", because the stand-in only sees requests that reached it.

**(c) Dropping the GitHub base override**
- `RpcGitEnvironment.PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is a required `string`, and `rpcChildEnvironment` always sets it [VERIFIED: test/e2e/_rpc.ts:56-67, 232-236]. The world's profile and scenario Pis always pass `currentRun().piEnvironment` [VERIFIED: features/support/world.ts:578-583, 918-944]; `startTuiSession` passes `this.tuiEnvironment ?? run.piEnvironment` [VERIFIED: world.ts:775-790]. Change: make the variable optional in `RpcGitEnvironment` (set only when defined), and add a world launch option that omits it — for the profile Pi, and also for the TUI session, because DFLOW-04's background pass runs only in a terminal session ("Only a tui session arms the background update", world-and-stand-ins.md:27) and needs the redirect extension there too.

**(d) Fallback seam:** not needed (see (b)). If the in-Pi seed fails for a reason the probe did not cover, D-BG-02 applies unchanged.

### Q6. Json mode (D-BG-09)

- Pi 1.5.0 accepts `--mode text|json|rpc` [VERIFIED: pi-coding-agent/dist/cli/args.js:41-55]; `resolveAppMode` returns `"json"` for `--mode json` [VERIFIED: main.js:85-87]; json runs `runPrintMode(runtime, { mode: "json", messages, initialMessage })` [VERIFIED: main.js:816-822], which binds extensions with `mode: mode === "json" ? "json" : "print"`, subscribes, writes each session event as `JSON.stringify(toJsonEvent(event))`, then `await session.prompt(initialMessage)` [VERIFIED: modes/print-mode.js:51-109]. A `/claude:plugin …` initial message runs the extension command like an RPC prompt.
- **Requirements for the driver:** (1) a model: `if (appMode !== "interactive" && !session.model) { …; process.exit(1); }` [VERIFIED: main.js:763-766] — load the scripted model extension and pass `--provider faux --model faux-1` (as the scripted TUI does, world.ts:100-102), with `TMPDIR={home}/tmp` and the `jiti-cache` symlink that `usePiWithProfile` prepares (world.ts:618-644), or the extension compiles into the shell's `/tmp`; (2) stdin closed: non-rpc modes `await readPipedStdin()` until `end` when stdin is not a TTY [VERIFIED: main.js:52-67, 735-741] — spawn with stdin `"ignore"`; (3) the message as the positional argument.
- **What it prints:** the extension's JSON strategy is the same in json and rpc: `case "json": case "rpc": { … appendEntry(...) }` → `sink.appendEntry("claude-plugin", payload)` [VERIFIED: shared/notification-dispatch.ts:171-187, 635-652]; Pi's `appendEntry` emits `{ type: "entry_appended", entry }` [VERIFIED: core/agent-session.js:2801-2806]; json mode prints every event unchanged except `message_update` [VERIFIED: modes/json-event.js:16-28]. So stdout carries `{"type":"entry_appended","entry":{"type":"custom","customType":"claude-plugin","data":<payload>}}` lines, the same entry shape the RPC message steps read (features/step_definitions/hook/messages.steps.ts:32-47). The subscription starts after `bindExtensions` [VERIFIED: print-mode.js:53-88], so load-time payloads are probably not printed [ASSUMED; the seed confirms].
- The RPC driver validates each payload with `NOTIFICATION_PAYLOAD_SCHEMA` and filters `customType === "claude-plugin"` in a private `claudePluginPayloads` [VERIFIED: features/lib/pi-commands.ts:44, 97-111]. Export it (or move it) so the json driver reuses the same validation (DRV-01).
- Result: json mode exists and runs a slash command; BOOT-01 keeps its json clause, and no P1-DC narrowing is needed.

### Q7. Browse picker

- Driver capabilities: `PiTuiSession.start` spawns `python3 pi-tui-pty.py -- <pi tui args>` with a 40x120 PTY [VERIFIED: features/lib/pi-tui.ts:190-212; pi-tui-pty.py:27-29]; it offers `text` (cumulative output with control sequences removed), `sendLine`, `typeText` (raw keystrokes), `waitForText`, `markOutput`/`waitForTextAfter`, `waitForQuiet`, `reload`, `stop` [VERIFIED: pi-tui.ts:214-320]. It has no screen model: `text` is the whole output stream, not the current screen.
- Picker structure: four screens, marketplaces → plugins → actions → install scope [VERIFIED: edge/browser/plugin-browser.ts:1-13]. Rows: marketplace label `${m.name} [${m.scope}]`, description `${pluginCount} plugin(s) -- ${source}` (296); plugin label `${statusTag(p.status)} ${p.name}` (375); action labels `capitalize(a)` of `"install" | "uninstall" | "info" | "enable" | "disable"` (43, 407); scope rows `Project local (Recommended)`, `Project`, `User (global)` (443-457). Titles: `Browse Claude Plugin Marketplaces` with hint `↑↓ navigate • enter open • esc cancel` (311); `Plugins in ${mp.name} [${mp.scope}]` (398); `Action: ${plugin.name} @ ${mp.name}` (435). Keys go to pi-tui `SelectList.handleInput`; `escape` goes back or cancels (500-515). [VERIFIED: plugin-browser.ts lines cited]
- Driver design: wait for a title with `waitForTextAfter(title, mark)`, read the rows that render after the mark, move with down-arrow bytes and `\r`, cancel with `\u001b`. The byte forms (`\u001b[B`, `\r`, `\u001b`) are what a plain PTY sends when no kitty keyboard reply arrives [ASSUMED]. Because Pi's TUI may redraw only changed lines, row reading must anchor on the first full frame after the title, not on later redraws [ASSUMED; the seed proves or refutes].
- Note for Phase 12 (not Phase 1): the install-scope screen offers `Project local (Recommended)` first, so BROWSE-02's "installs it in its marketplace's scope" is a choice the scenario makes, not a default.

### Q8. Async hooks (D-BG-12)

- Declaration: the handler schema accepts `asyncRewake`, `rewakeMessage`, `rewakeSummary` as properties of any type and allows other keys; the entry (matcher group) accepts `async` [VERIFIED: domain/components/hooks/schema.ts:4-57].
- Dispatch: only `entry.handlerDecl.asyncRewake === true` takes the background path (`spawnAndRegister`), and it returns `{ kind: "noop" }` without awaiting the child [VERIFIED: bridges/hooks/dispatch-exec.ts:163-195]. **Plain `async: true` is parsed but runs the synchronous path**; it is read only to label an on-failure reason (`const { async: background, asyncRewake } = entry.handlerDecl; return background === true || asyncRewake === true ? "an async hook" : undefined;`) [VERIFIED: bridges/hooks/on-failure.ts:91-92]. That is ASYNC-05's divergence to research in Phase 2.
- Exit handling: `rewakeSummary` is notified on every exit (`notifyAsyncRewakeSummary(ctx, run, entry.rewakeSummary)`), independent of the code; on code 2 with a non-empty stderr (else stdout) body, `pi.sendMessage({ customType: REWAKE_CUSTOM_TYPE, content, display: false, details: {...} }, { deliverAs: lane })` with `lane = ctx.isIdle() ? "nextTurn" : "followUp"`; a stale generation (after `/reload`) injects nothing [VERIFIED: bridges/hooks/async-rewake/registry.ts:405-472]. The summary payload kind is `async-rewake-summary` [VERIFIED: shared/notification-dispatch.ts:437-447] — not `hook-notice`, so the existing `the hooks show the user these messages:` step does not read it (it builds `kind: "hook-notice"` rows, messages.steps.ts:49-60).
- How the rewake reaches the model's next call: Pi converts a custom message to `{ role: "user", content: [{ type: "text", text }] }` [VERIFIED: pi-coding-agent/dist/core/messages.js:89-96], so `the model receives these calls:` shows it as a `user` row [VERIFIED: features/lib/scripted-model/script.ts:252-283]. No new model step is needed.
- `/reload` and reap: `shutdownInMemoryChildren` SIGKILLs tracked children on reload; `reapOrphans` reads the per-scope PID table at `<dataRoot>/_shared/<pid file>` and SIGKILLs pids whose `/proc/<pid>/environ` carries the dispatch marker [VERIFIED: registry.ts:488-560, 640-668; pid-table.ts:98-100]. Children are spawned `detached: false` (registry.ts header 17-21), so they share Pi's process group.
- **Gap for Phase 2 (ASYNC-04 reap):** `PiProcess.stop()` kills the whole process group [VERIFIED: features/lib/pi-process.ts stop → `killProcessGroup`], which also kills the hook. A scenario where "a Pi process died" and left a hook running needs a way to SIGKILL only Pi's own pid. That belongs in the frozen `features/lib/pi-process.ts`, so Phase 1 must add it (e.g. `PiProcess.crash()`), or Phase 2 cannot cover ASYNC-04's reap clause.
- Fixture extension (hook-files.ts already has `script` forms with `stderr`, `output`, `exit code`, `sleep`, `meets` columns [VERIFIED: features/lib/hook-files.ts:30-60, 77-122, 175-193]): add columns `async rewake` (`true`), `rewake message`, `rewake summary`, `async` (plain), and `waits` (the script waits for `$HOME/hook-releases/<name>` before exiting). The script appends `start`/`exit <code>`/`end` lines with its pid to a lifecycle log (e.g. `{home}/harness/hook-lifecycle.jsonl`) and writes `hook-<name>-<pid>.pid`, so the release-time `assertStandInsStopped` check (turn-records.ts:99-114) fails a hook that outlives its Pi. Add a `When` that creates the release marker and waits for the hook's `end` line, recording the stand-in lines and records it produced as the turn (precedent: `recordSessionAction` in hook/session.steps.ts:81-98), and a `Then` for `async-rewake-summary` payloads.

### Q9. Earlier-release fixtures (D-BG-13)

- Current schema: `schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)])` [VERIFIED: persistence/state-io.ts:376-385]. A newer version is refused before migration: `if (parsedRecord !== undefined && Object.hasOwn(parsedRecord, "schemaVersion") && parsedRecord.schemaVersion !== 1 && parsedRecord.schemaVersion !== 2 && parsedRecord.schemaVersion !== 3) { throw new Error(\`state.json at ${stateJsonPath} has an unsupported schema version\`); }` [VERIFIED: state-io.ts:527-539]. "Newer unsupported schema" = any `schemaVersion` other than 1, 2, 3 (e.g. `4`); an absent `schemaVersion` is not refused. A migrated load writes schema 3 in the background (`persistMigratedState`, not awaited) [VERIFIED: state-io.ts:599-603].
- Migrations filled (migrate.ts header 13-31): `manifestPath`/`marketplaceRoot`, `resources.agents|mcpServers|hooks` → `[]`, `enabled` → `true` (ENBL-02), `provenance` → `"explicit"` (D-04-03), and the `autoupdate` scrub only when `claude-plugins.json` exists (D-13) [VERIFIED: persistence/migrate.ts:1-31; state-io.ts:557-563].
- Releases that wrote each shape (git history, this session):
  - **schemaVersion 1** without `enabled`/`provenance`: last release **v0.6.0** (`schemaVersion: Type.Literal(1)`, plugin record `version, resolvedSource, compatibility{installable,notes,supported,unsupported}, resources{skills,prompts,agents,mcpServers,hooks}, installedAt, updatedAt`; marketplace record `name, scope, source, addedFromCwd, manifestPath, marketplaceRoot, lastUpdatedAt?, plugins`) [VERIFIED: `git show v0.6.0:extensions/pi-claude-marketplace/persistence/state-io.ts` lines 49-108]. ENBL-02 landed in `222a7344` (2026-06-21, release 0.6.1).
  - **schemaVersion 2** (`enabled`, no `provenance`): last release **v0.19.2** (`schemaVersion: 2` written; union `[1, 2]`) [VERIFIED: `git show v0.19.2:…/state-io.ts` lines 280-304]. Schema 3 landed in `8b6ac3bc` (#198), first released in v0.20.0.
  - **no `claude-plugins.json`** (MIG-01's input): config files landed in `5f1d0c57` (#51, 2026-06-12), first released in v0.5.0; last release without them is **v0.4.3**, whose marketplace record still had `autoupdate: Type.Optional(Type.Boolean())` and `schemaVersion: Type.Literal(1)` [VERIFIED: `git show v0.4.3:…/state-io.ts` lines 71-77].
  - **legacy `mcp.json`**: plugin MCP servers moved to `mcp-adapter.json` in `94160614` (#250), first released in v0.20.0; last release writing `<scopeRoot>/mcp.json` is **v0.19.2**, whose entries are the declared server under its declared name plus `_piClaudeMarketplace: { plugin, marketplace }` (`safeSet(stamped, name, { ...entryObj, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker })`) [VERIFIED: `git show v0.19.2:…/bridges/mcp/stage.ts` lines 6-7, 221-224, 278; `…/bridges/mcp/marker.ts` lines 13-18, 62].
- MIG-01: `migrate-config.ts` writes the config only on loadConfig's `absent` arm; `existing-valid`, `existing-invalid`, `empty-state`, `local-invalid` short-circuit, all load-time silent [VERIFIED: persistence/migrate-config.ts:1-60]. The current legacy-move reader keys on the marker and re-stages from the plugin's source (orchestrators/reconcile/mcp-migration.ts:1-50).
- What exists: `earlier-version-state.ts` writes a schema-3 marketplace record for a dir marketplace and its base-config declaration, rewrites a url source, and reads a record [VERIFIED: features/lib/earlier-version-state.ts:20, 52-112]; `mcp-builtin-earlier-record.ts` drops `mcpServerConfigs`/`mcpBundle` from a record (MREC-02) via `installation-record.ts` [VERIFIED: features/lib/mcp-builtin-earlier-record.ts:1-30].
- **Recommended writer shape:** install the plugin through Pi first (so the artifacts exist), then rewrite `state.json` into the target release's shape: drop every member that release did not write, set its `schemaVersion`, and (for v0.4.3) add `autoupdate` on the marketplace record and delete the scope's `claude-plugins.json` and local config; for the legacy MCP move, move the plugin's entries from `mcp-adapter.json` into `mcp.json` under their declared names with the v0.19.2 marker, beside a user entry with no marker. Each writer's doc comment names the release (`v0.6.0`, `v0.19.2`, `v0.4.3`) and the commit that ended that shape.
- **Caveat:** a real pre-config state (v0.4.3) has no `enabled` field, so CFGMIG-01's "carrying the enabled state" can only show `enabled: true` from a true earlier shape; a disabled plugin with no config arises only from a user deleting the config under a current release. See Dubious Choices.

### Q10. Model tools (D-BG-08)

- The tools are registered with `pi.registerTool` (`pi_claude_marketplace_list`, params `{}`; `pi_claude_marketplace_plugin_list`, optional `marketplace`, `scope` (`"user" | "project"`), `installed`, `available`, `unavailable`) [VERIFIED: edge/handlers/tools.ts:70-92, 177-193]. They are in every profile Pi's tool list (features/mcp-server/listing.feature:35-36). The list tool's content is one line per marketplace, `` `[${scope}] ${record.name} -- ${pluginCount} plugin(s) -- ${logical}` ``, or `No marketplaces configured.` [VERIFIED: tools.ts:142-156]; a load failure is `{ content: "Failed to load <subject>: <message>", isError: true }` [VERIFIED: tools.ts:119-125].
- Pi 1.5.0 honors `isError`: `return { result, isError: result.isError === true, durationMs };` [VERIFIED: node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js:588] (the carried json-output D-03 note says Pi 0.87.1 ignored it; 1.5.0 does not).
- The next call's messages carry the tool result, and `the model receives these calls:` already renders it as role `tool result`, text `<tool> returned: <text>` or `<tool> failed: <text>` [VERIFIED: features/lib/scripted-model/script.ts:261-268; features/step_definitions/model.steps.ts:95-105]; multi-line text is written with `\n` in the cell (precedent: features/agent/listing.feature:60). **No new step is needed** for D-BG-08's seed.
- Gap for Phase 10 (TOOL-03, unknown scope): Pi validates arguments before `execute` and fails the call with its own text: `Validation failed for tool "<name>":\n  - <path>: <message>\n\nReceived arguments:\n<json>` [VERIFIED: node_modules/@earendil-works/pi-ai/dist/utils/validation.js:49-61; agent-loop.js:487-548]. That is upstream text, which a scenario must not state (world-and-stand-ins.md "Upstream text"); a projection for it would live in the frozen `features/lib/upstream/`. Phase 1 should add that projector now (e.g. `pi_claude_marketplace_plugin_list failed: invalid argument /scope`), or Phase 10 cannot pin TOOL-03's scope case.

### Q11. Cucumber gates (`scripts/check-features.mjs`)

- Layout: under `step_definitions/`, depth ≤ 3 and `.steps.ts`; under `support/` and `lib/`, depth ≤ 3 and `.ts` (not `.steps.ts`); `lib/pi-tui-pty.py` is the one exception; a feature is exactly `<function>/<capability>.feature`; no catch-all names; no module beside a directory of the same name [VERIFIED: scripts/check-features.mjs:278-358]. So `features/lib/github-device-flow/{server,extension}.ts` is allowed; `lib/github-device-flow.ts` beside that directory is not.
- Feature rules: the title's kebab case equals `<dir>-<file>` (`Feature: Hook async`, `Plugin state migration`, `MCP server legacy move`, `Marketplace device flow`, `Plugin model tools`, `Plugin subagent child`); a description is required; scenario titles start upper case; steps lower case, no `should`, no `And`/`But`, no `Given` after `When`; tags only the four MCP tags on features/rules/scenarios and `@url`/`@github`/MCP tags on Examples [VERIFIED: check-features.mjs:361-548].
- Steps: the gate dry-runs every scenario and fails on unused, undefined, or ambiguous steps, and on step text that is not a Cucumber expression [VERIFIED: check-features.mjs:157-275].
- MCP rules: a scenario whose step text has the word `mcp`, or a value naming `mcpServers`/`.mcp.json`, needs exactly one implementation tag; `@mcp` scenarios never name `pi-mcp-adapter`; `@adapter-only`/`@builtin-only` name an ID [VERIFIED: check-features.mjs:551-622]. The legacy-move seed's steps name `mcp.json`, so it needs `@mcp` (D-BG-05); keep the word `mcp` out of the other seeds' steps.
- New function directories: none planned (hook, plugin, marketplace, mcp-server exist), so `.github/workflows/ci.yml` shard paths and `test/architecture/behavioral-shard-coverage.test.ts` need no change.
- "A step used only by a seed": the gate fails if a stream's rewrite leaves a frozen step unused, and the stream cannot delete it. Mitigation: seeds use steps the stream will keep using (generic setup and Then steps), and the layout.md "Behavioral gaps" section lists, per stream, the frozen steps its seed introduced and must keep in use.

### Q12. CI time

- `behavioral` job: matrix `adapter lifecycle` (`features/marketplace features/plugin`), `adapter components` (six component dirs), `builtin all` (`features`); `timeout-minutes: 15`; cucumber `parallel: 8` [VERIFIED: .github/workflows/ci.yml:119-174; cucumber.json:2-24].
- Measured on `main` (mcp-builtin merged, `450c417e` #303), CI run 42421611502, 2026-11-07: adapter lifecycle 4 m 07 s, adapter components 5 m 14 s, builtin all 3 m 03 s [VERIFIED: `gh run view 42421611502 --json jobs`]. 1.5 × the slowest = 7 m 51 s < 15, so `timeout-minutes: 15` stays unless the Phase 1 head measures over 10 minutes.
- Added cost (estimate): about 13-15 seed scenarios. Those that start a per-scenario Pi: async, stop-failure, compaction, model-tools, subagent-child (profile Pi each), device-flow (own Pi + redirect extension), legacy-move (`@mcp`, so under both profiles; a profile Pi if it shows servers running), browse (TUI Pi), bootstrap (json Pi + TUI Pi). The rest (state-migration, config-migration, stale lock) use the shared Pi plus a new session. At roughly 5-15 s each spread over 8 workers, each leg grows well under a minute [ASSUMED]. Phase 1's gate plan measures the real run.

## Architecture Patterns

### System Architecture Diagram

```text
 feature step (When/Given)                                             Then steps
        |                                                                  ^
        v                                                                  |
  ScenarioWorld (world.ts) --launch options--> _rpc.ts allowlist env ----+ |
        |  usePiWithProfile({companions, extraExtensions,                | |
        |      environment: {githubBase: "unset" | subagentChild})}      | |
        v                                                                v |
  +--------------------- Pi 1.5.0 process (rpc | json | tui) ------------+ |
  |  real extension (product)  scripted-model ext   harness exts          | |
  |    hooks bridge  <--agent_end/agent_settled/session_compact-- Pi core | |
  |    git (isomorphic-git -> simple-get -> https.request) ---+           | |
  |    Device Flow (global fetch) ----------------------------+           | |
  |                     github-redirect ext patches https.request/fetch   | |
  +-----------------------------|----------------|------------------------+ |
                                |                |                          |
             github.com:443 --> 127.0.0.1:<git host>   github.com/login/* --> 127.0.0.1:<device-flow stand-in>
                                |                |                          |
             other host --> refused (logged) ---+                          |
                                                                           |
  {home}/harness/*.jsonl  (model-calls, hook-runs, hook-lifecycle, github-redirect, device-flow) ---+
  claude-plugin entries (rpc records / json stdout lines / TUI text)  -----------------------------+
```

### Recommended file layout (new and changed)

```text
features/
  lib/
    scripted-model/{extension,script}.ts   # error step, stop reason, context-tokens option (CHANGED)
    hook-files.ts, hook-recorder.ts         # async rewake columns, lifecycle log, release marker (CHANGED)
    earlier-version-state.ts                # v0.6.0 / v0.19.2 / v0.4.3 / newer-schema writers (CHANGED)
    mcp-legacy-config.ts (name at discretion)  # v0.19.2 marked mcp.json writer (NEW, or extend mcp-configuration.ts)
    state-lock-holder.ts                    # stale lock directory writer (CHANGED)
    github-device-flow/server.ts            # loopback HTTPS Device Flow stand-in (NEW)
    github-device-flow/extension.ts         # harness Pi extension: redirect + fail closed (NEW)
    https-git-host/server.ts                # expose key path for certificate reuse (CHANGED)
    pi-json-mode.ts                         # one-shot json driver (NEW)
    plugin-picker.ts                        # picker driver over PiTuiSession (NEW)
    pi-process.ts                           # crash(): SIGKILL Pi only (CHANGED)
    pi-commands.ts                          # export payload validation for reuse (CHANGED)
    upstream/pi.ts                          # tool-argument validation projector (CHANGED, see Q10)
  support/world.ts                          # launch options: no GitHub base, child env, json run, TUI extensions (CHANGED)
  step_definitions/ (shared/topic modules only; no stream verb module)
test/e2e/_rpc.ts                            # optional base URL, PI_SUBAGENT_CHILD slot, json args (CHANGED)
```

### Pattern: a harness Pi extension that reads its config from the harness directory

**What:** a `features/lib/<dir>/extension.ts` default-exported factory, loaded by `extraExtensions`, reading a JSON file a step wrote under `{home}/harness/` before Pi starts, logging one JSON line per event, never throwing out of handlers.
**When:** any in-Pi stand-in (redirect, built-in MCP stand-in, launch environment).
**Example (shape only; mirrors `features/lib/pi-launch-environment.ts` and `builtin-mcp-stand-in/extension.ts`):**
```typescript
// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function githubRedirect(_pi: ExtensionAPI): void {
  const config = readRedirectConfig(harnessDirectory(process.env.HOME ?? ""));
  https.request = redirectingRequest(originalHttpsRequest, config, log); // github.com -> 127.0.0.1:<git host>
  globalThis.fetch = redirectingFetch(originalFetch, config, log);       // github.com/login/* -> stand-in; others refused
}
```
[ASSUMED shape; the names are the planner's]

### Pattern: patching usage after the faux core (D-BG-07)

```typescript
// Source: faux.js:354-357 overwrites usage; event-stream.js:19-80 for the API.
streamSimple: (model, context, options) => {
  const inner = faux.streamSimple(model, context, options);
  const usage = pendingUsage.take(); // set by playNextStep for a step with `context tokens`
  if (usage === undefined) return inner;
  const outer = createAssistantMessageEventStream();
  void (async () => {
    for await (const event of inner) {
      outer.push(event.type === "done" ? { ...event, message: { ...event.message, usage } } : event);
    }
    const final = await inner.result();
    outer.end({ ...final, usage });
  })();
  return outer;
}
```
[ASSUMED shape; the per-call hand-off between `playNextStep` and the wrapper must be keyed to the call, not module state, because a child agent's Pi plays the same script]

### Anti-Patterns to Avoid
- **Setting `usage` on `fauxAssistantMessage`:** the faux core discards it (faux.js:158-167).
- **Lowering `reserveTokens` to force compaction:** works, but it is a settings route, not D-BG-07's step option, and it makes every reply compact.
- **Using the launch-environment extension for the child marker:** pi-subagents has already loaded and registers its tools; a real child's pi-subagents registers nothing.
- **A non-empty stale lock directory:** `rmdir` fails `ENOTEMPTY` and the product reports a generic error instead of taking the lock.
- **A second self-signed certificate for the Device Flow stand-in:** Pi trusts only the git host's `cert.pem`.
- **Reading the stand-in's request log as proof of "no request left the machine":** only requests that reached it are there; use the redirect extension's log.
- **Comparing the summarization call's rows in a compaction seed:** they hold Pi's prompt text (upstream).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lock acquisition in the fixture | own mkdir/mtime logic for "held" | `lockfile.check(...)` via `isStateLockHeld` | same rule the product uses |
| Payload validation in the json driver | a second schema | `NOTIFICATION_PAYLOAD_SCHEMA` through the RPC driver's helper | DRV-01 |
| Event stream for usage patch | custom async queue | `createAssistantMessageEventStream` | Pi's own result/iteration contract |
| TLS certificate for the stand-in | new openssl run | the git host's key/cert | one CA file trusted |
| Hook process lifecycle | polling `ps` | pid files + `assertStandInsStopped` | existing reset check |
| Earlier shapes | invented JSON | `git show <tag>:…` shapes, named in the writer | D-BG-13 |

**Key insight:** every stand-in that Pi reads at start (env, CA, ports, extensions) must be fixed before the Pi starts, so the world's launch options are the integration point for most of this phase.

## Runtime State Inventory

Not a rename/refactor phase. Omitted.

## Common Pitfalls

### Pitfall 1: The usage option never reaches Pi
**What goes wrong:** the compaction seed never compacts. **Why:** `withUsageEstimate` replaces usage (faux.js:134-168). **Avoid:** patch after the faux core. **Warning sign:** no `compaction_start` record in the turn.

### Pitfall 2: Auto compaction silently skipped
**What goes wrong:** usage is high but nothing happens. **Why:** `prepareCompaction` returns undefined with `keepRecentTokens: 20000` (compaction.js:609-643). **Avoid:** `pi keeps only one recent token when the hooks session compacts` first.

### Pitfall 3: Error turn consumes extra script steps
**Why:** retry (TUI Pi), overflow patterns, or `length` recovery (Q1). **Avoid:** profile Pi only; a non-retryable, non-overflow message; `length` only with default `keepRecentTokens`. **Warning sign:** "the model was called past the end of its script".

### Pitfall 4: json Pi hangs or exits 1
**Why:** stdin left open (readPipedStdin waits for end) or no model selected. **Avoid:** stdin `ignore`, scripted model + `--provider faux --model faux-1`.

### Pitfall 5: Device Flow never starts
**Why:** the base override still set (GHB-02), the run not a command, or print mode. **Avoid:** world option that drops the variable; drive over RPC. **Warning sign:** a `no credential was obtained for 127.0.0.1:<port>` cause.

### Pitfall 6: Redirected request fails TLS
**Why:** the stand-in has its own certificate, or the redirect keeps `hostname: github.com` (certificate is for `127.0.0.1`). **Avoid:** reuse the git host certificate; rewrite `hostname` to `127.0.0.1`.

### Pitfall 7: A seed-only step goes unused after a stream rewrites its seed
**Why:** `check:features` fails on unused steps (D-09) and the module is frozen. **Avoid:** seeds use steps the stream keeps; list them in layout.md.

### Pitfall 8: Orphan-reap scenario impossible
**Why:** `PiProcess.stop()` kills the process group. **Avoid:** add `crash()` in Phase 1.

### Pitfall 9: Picker rows unreadable from a differential redraw
**Why:** `PiTuiSession.text` is the stream, not the screen. **Avoid:** read rows from the first frame after the title mark; if that fails, keep the TUI reading to titles and choose by position.

## Code Examples

### Stale lock writer (D-BG-11)
```typescript
// Source: proper-lockfile lib/lockfile.js:84-86 (stale = mtime older than `stale` ms), :88-97 (rmdir).
export async function leaveStaleStateLock(extensionRoot: string, lockFile: string): Promise<void> {
  await mkdir(lockFile, { recursive: true });            // empty directory, as a dead holder leaves it
  const past = new Date(Date.now() - 60_000);           // well past stale: 10_000
  await utimes(lockFile, past, past);
  assert.equal(await isStateLockHeld(extensionRoot, lockFile), false);
}
```
[ASSUMED name; mechanism VERIFIED]

### json-mode run (D-BG-09)
```typescript
// Source: main.js:52-67, 763-766, 816-822; print-mode.js:84-109; notification-dispatch.ts:176-187.
spawn(process.execPath, [
  ...piArguments("json", [SCRIPTED_MODEL_EXTENSION]),   // new "json" mode adds ["--mode", "json"]
  "--provider", "faux", "--model", "faux-1",
  "/claude:plugin bootstrap",
], { cwd: sandbox.cwd, env: rpcChildEnvironment(sandbox, git, { TMPDIR }), stdio: ["ignore", "pipe", "pipe"] });
// read stdout lines; keep `entry_appended` whose entry.customType === "claude-plugin"; validate each payload.
```
[ASSUMED shape; `piArguments` takes `"rpc" | "tui"` today (_rpc.ts:256-268)]

## State of the Art

| Old approach | Current approach | When | Impact |
|--------------|------------------|------|--------|
| Pi 0.87.1 ignored tool `isError` | Pi 1.5.0 honors it (agent-loop.js:588) | Pi 1.x | TOOL-03 error results reach the model as `failed:` rows |
| child marker via launch-environment extension | spawn environment | this phase | pi-subagents inert, as in a real child |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `https.request`/`fetch` patch works inside Pi's jiti-loaded extension realm as in plain Node | Q5(b) | D-BG-02 fallback (product seam + GHB-02 amendment) becomes necessary |
| A2 | `https.get`/`http.get` must be patched separately | Q5(b) | a stray request bypasses fail-closed |
| A3 | json mode prints no load-time payloads | Q6 | the json driver must separate startup payloads from the command's |
| A4 | PTY key bytes `\u001b[B`, `\r`, `\u001b` drive pi-tui `SelectList` | Q7 | picker driver needs different bytes |
| A5 | Picker rows are readable from the first frame after the title | Q7 | the driver needs a screen model or position-only choices |
| A6 | Seeds add under one minute per CI leg | Q12 | a timeout raise in ci.yml |
| A7 | The redirect extension and usage-wrapper code shapes shown | Patterns | none (illustrative) |

## Open Questions

1. **Upstream projector for Pi's tool-argument validation text (TOOL-03).** What we know: the text is Pi's (validation.js:58-59). Unclear: whether Phase 10 needs the scope case at all. Recommendation: add a projector in `features/lib/upstream/pi.ts` now; it is small and the library freezes.
2. **Picker reading strategy.** Recommendation: the browse seed exercises list + choose + cancel; if row reading fails, record a P1-DC and fall back to title-anchored, position-based choices.
3. **Legacy-move seed scope.** The seed can prove the file move (both profiles, `@mcp`) without a profile Pi; "servers still run" is Phase 9's. Recommendation: file move only, to keep the seed cheap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.13.0 local (CI 24) | — |
| python3 | PTY bridge | ✓ | 3.15.2 | — |
| openssl | git host certificate | ✓ | 4.1.0 | — |
| git | product credential helper, fixtures | ✓ | 2.56.0 | — |
| `/proc/<pid>/environ` | orphan reap (Phase 2) | ✓ (Linux) | — | — |
| optional peer cache | companions in profile Pis | ✗ in this worktree | — | `node scripts/install-test-peers.mjs` (run by `test:cucumber`) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` (profiles `default`/`adapter`, `builtin`; `parallel: 8`) + `node:test` |
| Config file | `cucumber.json` |
| Quick run command | `npx cucumber-js <feature file>` (adapter); `npm run test:cucumber:profile -- --profile builtin <feature file>` for `@mcp` seeds |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req / criterion | Behavior | Type | Automated command | Red proof (recorded in plan SUMMARY) |
|---|---|---|---|---|
| FND-01 / SC1 async | an `asyncRewake` hook's start, exit 2, end recorded; rewake in next call; summary to user | cucumber seed `hook/async.feature` | `npx cucumber-js features/hook/async.feature` | set the fixture's `asyncRewake` to `false` → no lifecycle/rewake rows |
| FND-01 / SC1 device flow | user code shown; clone after authorization; redirect log has only github.com→loopback, no refusal | seed `marketplace/device-flow.feature` | `npx cucumber-js features/marketplace/device-flow.feature` | stand-in answers `access_denied` → add fails as authentication required; drop the redirect extension → request refused/unreachable |
| FND-01 / SC1 fixtures | v0.6.0 / v0.19.2 state loads; newer schema refused; v0.4.3 state writes config; v0.19.2 mcp.json moves | seeds `plugin/state-migration`, `plugin/config-migration`, `mcp-server/legacy-move` (`@mcp`) | `npx cucumber-js <file>`; builtin: `npm run test:cucumber:profile -- --profile builtin features/mcp-server/legacy-move.feature` | write `schemaVersion: 4` into the "older" fixture → unreadable; remove the marker → no move |
| FND-01 / SC1 tools | tool call result read in next call | seed `plugin/model-tools.feature` | `npx cucumber-js features/plugin/model-tools.feature` | expected row with a wrong plugin count fails |
| FND-01 / SC1 picker | lists, chooses, cancels in a real terminal | seed in `plugin/browse.feature` | `npx cucumber-js features/plugin/browse.feature` | cancel step asserting an install fails |
| FND-01 / SC1 child | profile Pi with child env: autoapply skipped | seed `plugin/subagent-child.feature` | `npx cucumber-js features/plugin/subagent-child.feature` | start without the variable → pending change applied, seed fails |
| FND-01 / SC2 error turn | StopFailure hook runs with the chosen type | seed `hook/stop-failure.feature` | `npx cucumber-js features/hook/stop-failure.feature` | step with a `reply` instead of `error` → no StopFailure run |
| FND-01 / SC2 auto compaction | PostCompact trigger `auto` | seed `hook/compaction.feature` | `npx cucumber-js features/hook/compaction.feature` | `context tokens` below threshold → no PostCompact run |
| FND-01 / SC2 json + terminal | same outcome in json, rpc, terminal | seed in `plugin/bootstrap.feature` | `npx cucumber-js features/plugin/bootstrap.feature` | json driver reading `message_update` only → no payload |
| FND-01 / SC2 stale lock | stale lock taken, live lock blocks | seed in `marketplace/state-lock.feature` | `npx cucumber-js features/marketplace/state-lock.feature` | mtime set to now → verb fails as lock held |
| FND-01 / SC3 | both profiles green; every new shared step used; layout rules | gate | `npm run test:cucumber`; `npm run check:features` | an unused step added → `check:features` fails |
| FND-02 / SC4 | frozen list matches; brief and root log exist | file checks | `test -f .planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md && test -f .planning/DUBIOUS-CHOICES.md`; `git diff --stat <phase-1 base>..HEAD` against the ROADMAP frozen list | — |
| FND-02 / SC5 | combined tree green; CI timeouts hold; 15 branches | gate + git | `npm run check`; `gh run view <id> --json jobs`; `git branch --list 'features/behavioral-gaps-phase-*'` shows 15 | — |

### Sampling Rate
- **Per task commit:** `npx cucumber-js <the plan's feature files>` and the `check:commit` hook.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` and `npm run test:modules` (ROADMAP Milestone rules "Gates").

### Wave 0 Gaps
- None for framework. The optional peer cache is installed by `test:cucumber`.

## Recommended plan split (consistent with the roadmap's Parallel structure)

Plans in one wave own disjoint files. The roadmap's suggestion is kept, with one change: every launch-plumbing edit (`world.ts`, `_rpc.ts`, `features/lib/pi-process.ts`, `features/support/pi-process.ts`) moves to Wave 1, because four Wave 2 stand-ins need it and `world.ts` can have one owner per wave.

| Wave | Plan | Owns | Seeds |
|---|---|---|---|
| 1 | Rules and records | `.agents/skills/cucumber/rules/layout.md` (Behavioral gaps section: ownership table, reserved feature files and verb modules `hook/{async,stop-failure,tool-failure,compaction,session-end}`, `plugin/{state-migration,config-migration,model-tools,browse,prune,bootstrap,subagent-child}`, `marketplace/{device-flow,state-lock}`, `mcp-server/legacy-move`), `.planning/DUBIOUS-CHOICES.md`, `.planning/PROJECT.md` D-BG rows, REQUIREMENTS.md/ROADMAP.md wording (D-BG-04, D-BG-16) | none |
| 1 | Pi launch seams | `test/e2e/_rpc.ts` (optional base URL, `PI_SUBAGENT_CHILD` slot, `"json"` arguments), `features/lib/pi-process.ts` (`crash()`), `features/support/world.ts` (profile options: drop GitHub base, child env; TUI extensions + env; json-run sandbox prep), `features/lib/pi-commands.ts` (export payload validation), `platform/pi-api.ts` (verify only: Pi types are re-exported, `pi-api.ts:55-75, 169-171`, so nothing to widen) | none (Wave 2 seeds prove it) |
| 2 | Scripted model | `features/lib/scripted-model/**`, `features/step_definitions/model.steps.ts`, `features/lib/upstream/**` (validation projector) | `hook/stop-failure.feature`, `hook/compaction.feature`, `plugin/model-tools.feature` |
| 2 | Async hooks | `features/lib/hook-files.ts`, `features/lib/hook-recorder.ts`, `features/step_definitions/hook/*.steps.ts` (topic modules) | `hook/async.feature` |
| 2 | Local fixtures | `features/lib/earlier-version-state.ts`, new MCP legacy writer (or `mcp-configuration.ts`), `features/lib/state-lock-holder.ts`, `scope-state.steps.ts`, `config.steps.ts`, `mcp-configuration.steps.ts`, `plugin/installation.steps.ts` if needed | `plugin/state-migration.feature`, `plugin/config-migration.feature`, `mcp-server/legacy-move.feature` (`@mcp`), seed in `marketplace/state-lock.feature` |
| 2 | Device Flow | `features/lib/github-device-flow/**` (new), `features/lib/https-git-host/server.ts` (key accessor), `git-host.steps.ts` | `marketplace/device-flow.feature` |
| 2 | Terminal and process | `features/lib/pi-tui.ts`, `features/lib/plugin-picker.ts` (new), `features/lib/pi-json-mode.ts` (new), `command.steps.ts`, `session.steps.ts`, `companion.steps.ts` if the child step lives there | seeds in `plugin/browse.feature`, `plugin/bootstrap.feature`, `plugin/subagent-child.feature` |
| 3 | Brief and gate | `.agents/skills/cucumber/rules/world-and-stand-ins.md` (new stand-ins, written from the Wave 2 SUMMARYs), `.planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md` (from `component-features-CHILD-SESSION-BRIEF.md`), ROADMAP frozen list reconcile, CI measurement and `ci.yml` only if a leg exceeds 10 min, `npm run check`, `npm run test:modules`, `git branch features/behavioral-gaps-phase-N` ×15 at the verified head (local, not pushed) | none |

Seed placement notes: Phase 13 (prune) needs no new stand-in (the live holder exists), so `plugin/prune.feature` gets no seed. The scripted-model plan's seeds use hook topic steps read-only; the async-hooks plan owns those modules, so the scripted-model plan must not add hook steps (put any it needs in its own wave or in the async plan).

## Risks

1. **Redirect inside Pi (A1).** Mitigated by the probe; the Device Flow seed is the in-Pi proof. Fallback: D-BG-02 seam.
2. **Picker reading (A5).** May need title-anchored, position-based choices; logged as a P1-DC if so.
3. **Seed-only steps going unused after a stream rewrite.** Mitigated by the layout.md list and the merge gate.
4. **Earlier-shape fidelity.** An old record carried members today's schema still accepts (additive optionals), but artifacts installed under v0.6.0 lived where that release put them; the fixture writes today's artifacts with an old record, which is a hybrid. The writer's doc comment must say what it reproduces and what it does not.
5. **World API designed before its Wave 2 users.** Keep the Wave 1 options small and named in the plans; a Wave 2 plan that needs more raises it before the wave starts.
6. **Combined-tree flakes** (concurrent-process tests, per user memory "CI race-test flake cluster"). Re-run before calling a gate red.
7. **Fallow/doc counts.** Each new harness Pi extension adds one `fallow-ignore-next-line unused-export` marker; `.planning/codebase/CONVENTIONS.md` states an exact marker count (47). Not a gate; update or note.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes (Device Flow stand-in) | fake token issued only to loopback; credential stored only in the sandbox `{home}/.git-credentials` |
| V5 Input Validation | yes | typebox validation of scripts, call records, payloads (DRV-01) |
| V9 Communications | yes | loopback-only servers; redirect extension fails closed for every non-loopback host |
| V6 Cryptography | no new | reuse the git host's certificate |

| Threat | STRIDE | Mitigation |
|---|---|---|
| A test request reaches real github.com | Information disclosure | fail-closed redirect + `--offline` + `PI_OFFLINE=1`; refusal log asserted empty |
| Real user credentials read or written | Information disclosure / Tampering | allowlist env (`HOME`, `PI_CODING_AGENT_DIR` in sandbox, `GIT_CONFIG_GLOBAL` in sandbox) |
| Orphaned hook processes leak across scenarios | Denial of service | pid files + `assertStandInsStopped`; `crash()` scenarios rely on the next load's reap |

## Dubious Choices

- **DC-A (D-BG-10 premise):** CONTEXT says nothing else changes behavior on `PI_SUBAGENT_CHILD`; pi-subagents does (it registers nothing). This supports the decision (a real child's pi-subagents is inert too) but the decision's rationale text is wrong; the planner should note it rather than rely on it.
- **DC-B (D-BG-03 certificate):** "the same certificate approach as https-git-host" read as reusing the git host's key and certificate, because Pi trusts only one CA file.
- **DC-C (plan split):** launch plumbing moved from the roadmap's Wave 2 "Terminal and process" plan to Wave 1.
- **DC-D (D-BG-13 / CFGMIG-01):** a true pre-config state (v0.4.3) cannot carry `enabled: false`; covering the enabled state needs a current-schema state with its config deleted, which is not an "earlier release" shape.
- **DC-E (Phase 1 additions beyond the Builds list):** `PiProcess.crash()` (ASYNC-04), the tool-validation upstream projector (TOOL-03), and TUI launch options for the redirect (DFLOW-04). Each is needed by a stream that cannot edit the frozen file.
- **DC-F (D-BG-07 mechanism):** the usage option wraps `streamSimple` because the faux core overwrites usage, and the seed also uses the `keepRecentTokens: 1` Given.

## Sources

### Primary (HIGH confidence)
- Installed packages read this session: `@earendil-works/pi-ai` 1.5.0 (`providers/faux.{js,d.ts}`, `utils/{retry,overflow,validation,event-stream}.js`), `@earendil-works/pi-coding-agent` 1.5.0 (`core/agent-session.js`, `core/compaction/compaction.js`, `core/settings-{manager,defaults}.js`, `core/messages.js`, `core/extensions/types.d.ts`, `main.js`, `cli/args.js`, `modes/{print-mode,json-event}.js`), `@earendil-works/pi-agent-core` (`agent-loop.js`), `isomorphic-git` 1.44.5 `http/node`, `simple-get` 4.0.1, `proper-lockfile` 4.1.2.
- Repository files cited inline (product, `features/`, `test/e2e/_rpc.ts`, `scripts/check-features.mjs`, `.github/workflows/ci.yml`, `cucumber.json`, cucumber skill rules).
- Git history: tags v0.4.3, v0.6.0, v0.19.2, v0.20.0; commits `222a7344`, `8b6ac3bc`, `5f1d0c57`, `94160614`.
- Probe: `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/probe/https-probe.mjs` (output quoted in Q5b).
- CI: `gh run view 42421611502` (main, 2026-11-07).

### Secondary (MEDIUM confidence)
- pi-subagents 0.84.0 in the main checkout's optional-peer cache (`/home/acolomba/pi-claude-marketplace/node_modules/.cache/optional-peers/node_modules/pi-subagents/`), the same floor `scripts/install-test-peers.mjs` installs.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from node_modules.
- Architecture: HIGH for the mechanisms (code read); MEDIUM for the redirect in Pi and picker reading (seed-proven).
- Pitfalls: HIGH — each traced to a cited line.

**Research date:** 2026-11-07
**Valid until:** 2026-12-07 (Pi pinned at 1.5.0; re-check if the Pi dev dependency moves)
