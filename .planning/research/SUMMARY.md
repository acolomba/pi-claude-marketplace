# Project Research Summary

**Project:** pi-claude-marketplace, milestone `marketplace-features` (Marketplace Behavioral Tests)
**Domain:** Cucumber behavioral suite for the `/claude:plugin marketplace` commands, run through a real headless Pi in RPC mode against local stand-ins, plus one small production seam (D-MF-01, a GitHub clone-base override).
**Researched:** 2026-10-15
**Confidence:** HIGH overall. MEDIUM on the `git http-backend` CGI details and on whether Pi's `--offline` RPC child lets extension HTTPS through.

## Decisions Taken After Research (2026-10-15)

- **Variable name:** `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, not `GITHUB_BASE_URL` (the Terraform GitHub provider reads the latter as an API URL). Amends D-MF-01.
- **Override reach:** the full seam. One helper serves the clone URL, origin matching (leftover-clone recognition), the inline literal at `orchestrators/marketplace/update.ts:398-401` and `update-flow.ts:151`, and the auth host, which binds to the override's `host:port`. GitHub sources then run end to end against the stand-in, including 401 and leftover-clone scenarios. Planning settles whether `canonicalCloneUrl` itself follows the override or only `originMatchesSource` does.
- **C-10** (a `marketplace.json` outside `.claude-plugin/` updates as `source missing`): fix it in this milestone, test first.
- **Upstream parity gaps** (reserved official names, hosted `marketplace.json` URL, `/plugin market` alias): out of scope, filed in BACKLOG.md.
- **Defaults taken without a separate question:**
  - An invalid override value fails with a typed error naming the variable.
  - The cucumber rule is amended so the git stand-in can share the Pi run's lifetime.
  - Scenarios pin current behavior for `autoupdate <name>` without `--scope` (it flips both scopes) and for the missing credential hint on `add`. Both are recorded as open questions, not changed.

## Executive Summary

This is a test-infrastructure milestone on a brownfield Pi extension. The suite already has one Pi child per cucumber worker, a per-scenario sandbox reset, a strict single-cascade driver, and 13 plugin scenarios. The work extends that shape to every marketplace verb and source kind.

- Local directory and direct `marketplace.json` sources need no stand-in.
- https-git-URL and GitHub sources need one loopback HTTPS git server:
  - a `node:https` CGI wrapper around `git http-backend`;
  - a run-time `openssl` certificate trusted through `NODE_EXTRA_CA_CERTS`;
  - bound to `127.0.0.1` only, with a request log and per-repository failure arming (401, 404, 5xx, connection drop).
- No new npm package is needed. `selfsigned`, `mockttp` and similar libraries were rejected.

The central design fact is lifetime. Pi reads `NODE_EXTRA_CA_CERTS` and the override variable once at start, and the override carries the server's port. So the stand-in is one server per worker:
- started before Pi;
- kept on the existing `PiRun` record;
- reset in the single `Before()`.

This needs an amendment to the cucumber skill's one-module-state rule.

The main risks are scenarios that pass for the wrong reason or touch the real world:
- a 401 that reaches the developer's credential helper;
- Device Flow calling real github.com;
- a partial override that leaves auth or update on github.com;
- result normalization that hides wrong-port or wrong-path bugs.

## Where the Research Disagreed

### 1. How far the override reaches (resolved: full seam)

| | STACK.md | ARCHITECTURE.md / PITFALLS.md |
|---|---|---|
| Where it is read | Only the `github` arm of `networkCloneUrl` (`domain/clone-key.ts`) | One seam in `shared/`: wire URL, identity and `originMatchesSource` all follow |
| `canonicalCloneUrl` | Must not change; keys and state stay independent of an env var | Its github arm builds from the override; byte-identical when unset |
| Auth host | Stays `github.com`; the `onAuth` host mismatch cancels early | Derived from the override (`127.0.0.1:<port>`); no provider matches, so Device Flow can never fire |
| `update.ts:398-401`, `update-flow.ts:151` literals | Left alone; update fetches the recorded `origin` | Replaced; a missed literal is a network leak and a wrong-reason pass |
| GitHub-kind 401 and leftover scenarios | Moved to the URL source | Written against the GitHub source |

**Agreed by all:**
- No GitHub-shaped 401 may reach real github.com, a keychain, or Device Flow.
- `list`, `info` and `claude-plugins.json` show GitHub sources in github.com terms.
- The reader lives in `shared/`, never `platform/git*` or `platform/github-*`: ESLint BLOCK F matches the bare substring `platform/git`.

**Open for planning:** whether only `originMatchesSource` accepting an origin under the configured base is enough. That would keep cache keys and state identity stable.

### 2. Smaller disagreements (resolved)

- **Request-log assertions:** required. Every `list`, `info` and `remove` git scenario, and every refused source form, asserts an empty request log (NFR-5).
- **Certificate flag:** `-nodes`, not `-noenc`. It works on LibreSSL and on OpenSSL 1.1 through 4.x.

## Key Findings

### Recommended Stack

No new dependencies:
- `git`, spawned as `git http-backend` and also used to build fixtures;
- `openssl` (about 20 ms per certificate);
- `node:https` and `node:child_process`.

`features/` is outside the rule-pack network bans.

- **Certificate:** `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout key.pem -out cert.pem -days 1 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1`, made per worker at run time. Never commit a key.
- **`NODE_EXTRA_CA_CERTS`:** an absolute path, and the file exists before `PiProcess.start`. A missing file only warns, and then every clone fails as self-signed.
- **Pi child env:** the existing allowlist plus a typed `extraEnv` on `tests/e2e/_rpc.ts::startRpcPi`. It carries exactly these and never spreads `process.env`:
  - `NODE_EXTRA_CA_CERTS`
  - `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`
  - `GIT_CONFIG_NOSYSTEM=1`
  - `GIT_CONFIG_GLOBAL`
- **CGI and fixture-git env**, built from scratch:
  - a temp `HOME`, `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`;
  - pinned author and committer names and dates;
  - `-c init.defaultBranch=main` and `commit.gpgsign=false`;
  - `CONTENT_LENGTH` always set; `Git-Protocol` passed through as `GIT_PROTOCOL`.
- Use `127.0.0.1` everywhere, never `localhost`. HTTPS only.
- CI (`ubuntu-latest`) has Git 2.55.0 and OpenSSL 3.0.13, so no setup step is needed.

### Expected Features

FEATURES.md proposes about 100 candidate requirements as `MF-<verb>-NN`.

**Must have:**
- **`add`** over directory, file, url and GitHub sources:
  - success and duplicate name;
  - source missing and invalid manifest;
  - refused forms as an Outline, with zero requests at the git host;
  - 404, 5xx and connection drop.
- **`remove`:**
  - plugin cascade;
  - new-session and re-add proofs;
  - both not-added forms;
  - the `rm` alias.
- **`list`, `info`, `update`, and `autoupdate`/`noautoupdate`.** `update` covers single, bare (one payload per marketplace) and armed failures.
- Usage and help errors.
- The NFR-5 empty request log.

**Should have:**
- 401 with a stored credential.
- Rows for the verbatim URL, GitHub spelling folding, and refs.
- Scope asymmetries, LIFE-06, and `plugin-info` failure rows.

**Anti-features (never test):**
- live network;
- `state.json` or clone-directory contents;
- Device Flow;
- lock-held and EACCES paths;
- text-renderer bytes;
- literal timestamps or ports.

FEATURES.md also lists 13 doc-versus-code conflicts (C-1 to C-13). Scenarios pin the code, and the doc fixes are queued separately.

### Architecture Approach

Extend the one-Pi-per-worker design; do not add a second lifetime.

**Run lifecycle:**
- `BeforeAll` creates the run root, starts the git host, then starts Pi with the host's env.
- `Before()`:
  1. replaces a busy Pi, using the same env;
  2. resets the host (repositories, arming, request log, CGI children) and asserts it is empty;
  3. empties the sandbox and starts a session.

**Driver:**
- `runCommandPayloads` returns every payload, each validated against `NOTIFICATION_PAYLOAD_SCHEMA`, and checks the expected kinds and count.
- The strict single-cascade `runCommand` stays for plugin setup.
- Run-specific values (sandbox paths, host origin) use exact-token substitution in both directions.

**What `Then` steps observe, in order:**
1. the command payload;
2. a follow-up `list` or `info`;
3. the user-owned `claude-plugins.json`;
4. the stand-in request log.

Never `state.json` or clone directories.

**Components:**
1. `features/lib/https-git-host.ts` (new): the stand-in.
2. `features/lib/git-marketplace.ts` (new): the bare-repository fixture. GitHub and URL sources share the layout `/<owner>/<repo>.git`.
3. `features/lib/pi-commands.ts` (modified): the payload driver.
4. `features/support/{pi-process,world}.ts` (modified): `PiRun.gitHost`, the extended reset assertion, and `results: NotificationPayload[]`.
5. Step modules `features/step_definitions/marketplace/{publishing,results}.steps.ts`, `git-host.steps.ts`, `config.steps.ts`; features in `features/marketplace/*.feature`.
6. Production: `shared/github-base-url.ts` plus edits at the seam sites.

The driver must cover more payload kinds than the milestone goal lists: `usage-info` (from `marketplace help`) and `plugin-info` (from `info` on a broken manifest).

### Critical Pitfalls

1. **A 401 consults the developer's real credential helper.** A sandboxed HOME does not stop `/etc/gitconfig` helpers.
   - Set `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL` in Pi's env.
   - A scenario that needs a credential gets one from a `Given` that writes the sandbox `.gitconfig` and `.git-credentials`.
2. **Partial override wiring.** Fourteen files hard-code the host, and `update.ts:398` holds an inline literal.
   - Use one seam, plus a source-walk gate against new `"github.com"` literals.
   - Never loosen the `onAuth` host guard.
3. **Stand-in lifetime versus Pi's start-time env.** Start the host before Pi, keep it on `PiRun`, and pass the same env when Pi is replaced. Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`.
4. **Scenarios a wrong implementation still passes.**
   - Substitute exact tokens; no regex normalization of ports or paths.
   - Compare `lastUpdatedAt` within a time window; do not hide it.
   - Assert exact payload kind sequences.
5. **Host git config and CGI edge cases.**
   - Build the git env from scratch.
   - Put `'error'` handlers on every stream.
   - "Drop" is an immediate `socket.destroy()`. isomorphic-git has no client timeout, so there is no hang arm.
   - Bind `127.0.0.1` explicitly.
   - Unit-test the CGI header parser.

Also:
- error-text drift between Node 26 and Node 24;
- refused forms pointed at the stand-in, so a parser regression shows up in the log;
- same-size manifest rewrites hitting the mtime/size cache (path-source version rewrites must change the manifest size);
- no gate runs the unused-step check today.

## Implications for Roadmap

### Phase 1: Driver widening and path-source marketplace features

**Rationale:** Every later phase uses the widened driver, and this phase needs no network. Most scenarios land here.

**Delivers:**
- `runCommandPayloads` and world `results`.
- The step-module split and `config.steps.ts`.
- Sandbox-relative `~/marketplaces/<name>` sources and exact-token placeholders.
- An `UNUSED` step check wired into a gate.
- Features for local directory and manifest-file sources:
  - `add`, including the refused-form Outline and usage errors;
  - `list`;
  - `info` (single, fan-out, not added);
  - `remove`, with the plugin cascade;
  - `update`, single and bare;
  - `autoupdate` and `noautoupdate`;
  - `marketplace help`.
- The C-10 fix, test first.

### Phase 2: GitHub clone-base override (D-MF-01), production seam

**Rationale:** Independent of `features/` and reviewable on its own; it can run in parallel with Phase 1. It gates Phase 4.

**Delivers:**
- `shared/github-base-url.ts`: read on every call, with validation and a typed error.
- Its paired unit test, and override cases in each affected unit test.
- Edits at every seam site, with auth bound to the override host.
- A source-walk gate against new `"github.com"` literals.
- CHANGELOG and README notes.

### Phase 3: HTTPS git host stand-in and URL sources (walking skeleton first)

**Rationale:** The riskiest phase. Its first plan is one end-to-end scenario, proving that `PI_OFFLINE` lets extension HTTPS through and that the scenario really reaches the stand-in.

**Delivers:**
- `https-git-host.ts` with a unit-tested header parser.
- `git-marketplace.ts` and `_rpc.ts` `extraEnv`.
- `PiRun.gitHost` and the cucumber rule amendment.
- `git-host.steps.ts`.
- URL-source features:
  - add, update, remove and info;
  - re-add after remove;
  - 404, 5xx and drop;
  - verbatim path;
  - the empty-log NFR-5 `Then`s.
- CI timing recorded at the end of the phase.

### Phase 4: GitHub sources through the override, and 401 coverage

**Delivers:**
- `owner/repo` and `https://github.com/...[.git][#ref]` add, update and info through the stand-in, with display staying github.com.
- Spelling-fold and ref rows.
- 401 scenarios with a per-scenario stored credential, on both URL and GitHub sources.
- A credential-isolation negative control, run once by hand.

### Phase 5: Suite review gate and close (may fold into Phase 4)

**Delivers:**
- A clean dry-run usage report and `fallow dupes` over the fixtures.
- Runs under Node 24 and 26.
- Hostile `~/.gitconfig` and planted system-helper controls, run once by hand.
- A CI duration check (consider `parallel: 4` on CI).
- The cucumber skill review.
- The C-1 to C-13 doc fix list.
- The milestone audit.

### Research Flags

- **Phase 2:** re-run the inventory of github.com literals (`rg 'github\.com' extensions/`), and settle identity (`canonicalCloneUrl` vs `originMatchesSource`).
- **Phase 3:**
  - the `PI_OFFLINE` walking skeleton;
  - CGI handling of `CONTENT_LENGTH`, chunked bodies and `Git-Protocol`;
  - the payload order of a bare `update`, including any trailing `mcp-config-notices`.
- **Phase 4:** credential-helper isolation on macOS (LOW confidence).

## Open Questions Carried Forward

- **Override changed after `add`:** `update` fetches the clone's recorded `origin`, so it keeps the old base. Document it, or re-point the origin; decide in Phase 2.
- **`autoupdate` without `--scope`:** `autoupdate <name>` flips both scopes, while `update` and `remove` act on the project scope only. Intended?
- **Credential hint on `add`:** GAUTH-04's `git credential approve` cause line appears only on `update`.
- **Minor conflicts:**
  - C-11: `--local` is missing from `MARKETPLACE_USAGE`.
  - C-13: `update` classifies a 404 as `network unreachable`, while `add` reports `source missing`.
- **Optional:** rename `PluginWorld` to `ScenarioWorld`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Checked in code and by local runs; MEDIUM for undocumented `http-backend` CGI details |
| Features | HIGH / MEDIUM | Behavior read from source; MEDIUM on doc/code conflicts and upstream parity |
| Architecture | HIGH / MEDIUM | MEDIUM until the stand-in runs inside Pi `--offline` |
| Pitfalls | HIGH | MEDIUM on CGI behavior; LOW on macOS/LibreSSL |

## Sources

- In-tree source read 2026-10-15:
  - `domain/{clone-key,source,manifest-cache,auth-registry}.ts`
  - `orchestrators/auth-host.ts`
  - `orchestrators/marketplace/{add,update,shared}.ts`
  - `orchestrators/plugin/update-flow.ts`
  - `platform/{git,git-auth-callbacks,git-credential}.ts`
  - `shared/{notification-wire,git-failure-classifiers}.ts`
  - `tests/e2e/_rpc.ts`
  - `features/**`
  - `eslint.config.js`, `.fallowrc.json`, `.agents/skills/cucumber/rules/*.md`
- Local experiments:
  - the 2026-10-15 CGI spike (isomorphic-git clone and fetch over HTTPS);
  - the openssl command on OpenSSL 4.0.3;
  - a Node 26.11.1 child with and without `NODE_EXTRA_CA_CERTS`.
- Archived any-git-host UATs (`.planning/milestones/ws-git-hosts-2026-10-01/`).
- Claude Code 2.1.296 binary grep: GitHub clone URL is the literal `https://github.com/${repo}.git`; no base-URL variable.
- [git-http-backend docs](https://git-scm.com/docs/git-http-backend)
- [Node CLI: NODE_EXTRA_CA_CERTS](https://nodejs.org/api/cli.html#node_extra_ca_certsfile)
- [runner-images Ubuntu 24.04 readme](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
- [terraform-provider-github](https://github.com/integrations/terraform-provider-github)

_Research completed: 2026-10-15._
