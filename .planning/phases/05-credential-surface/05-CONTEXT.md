# Phase 5: Credential Surface - Context

**Gathered:** 2026-11-27
**Status:** Ready for planning

<domain>

## Phase Boundary

Git authenticates only through what the machine already holds: ssh keys and the ssh agent, and the git credential helpers the user configured (gh's `gh auth setup-git`, Git Credential Manager, `glab auth setup-git`, `store`, and others). The extension keeps no git token of its own. It reads no `GITHUB_TOKEN`, `GH_TOKEN`, or other token variable into a URL, header, or argument. The GitHub and GitLab OAuth Device Flow is removed. A user who stored a token through Device Flow keeps working over HTTPS, because that token stays in their credential helper and system git reads it. The extension deletes no stored credential.

Requirements: SG-AUTH-01, SG-AUTH-02, SG-AUTH-03. Failure-message wording for an auth failure belongs to Phase 6 (failure-message parity), not here.

</domain>

<decisions>

## Implementation Decisions

### Device Flow (Q2)

- **D-SG-27: Device Flow is removed (upstream parity).** Claude Code has no Device Flow and no git token of its own (research FEATURES.md E-SG-12, E-SG-13). Delete:
  - `domain/github-auth.ts`, `domain/auth-registry.ts` (both providers, GitHub and GitLab), `platform/git-credential.ts`, `platform/git-one-shot-credential.ts`, and the builders in `orchestrators/auth-host.ts` (delete the module if nothing else remains in it);
  - the `credentialOps`, `deviceFlowHttp`, and `authMemo` threading through every orchestrator, edge handler, and the factory;
  - the Device Flow retry in `platform/git.ts` (D-SG-14's `https-auth` retry with the one-shot helper);
  - the Device Flow notification messages and reasons in the `shared/notification-*` family, with their wire and JSON schema entries and docs;
  - the `fetch-chokepoint` exemption for `domain/github-auth.ts` (the allow-list keeps only `platform/hosted-manifest-fetch.ts`), the `child-process-chokepoint` or `GIT_PROCESS_IMPORTERS` entries that only `git-credential.ts` needed, the matching `CREDENTIAL_LEAK_TARGETS` entries (a positional pair, edited together), and any `NETWORK_SEAMS` entry that only existed for Device Flow;
  - `features/marketplace/device-flow.feature`, the stand-in `features/lib/github-device-flow/`, the loopback `CONNECT` proxy kept only for Device Flow, and the test doubles and contracts (`test/domain/device-flow-*`, `test/platform/credential-ops-*`, `test/architecture/github-device-flow-*`, `test/integration/auth-e2e.test.ts`) with their owner tests.
- D-SG-27 supersedes D-SG-14 and retires D-79-04, D-79-05, D-BG-1101, D-BG-1102 and the GAUTH Device Flow requirements, each amended in place in PROJECT.md with a dated pointer to D-SG-27. GAUTH-03's rule (every host uses the stored credential) stays true through system git and its helpers.
- The non-interactive git environment stays exactly as Phase 2 set it (D-SG-05: `GIT_TERMINAL_PROMPT=0`, empty `GIT_ASKPASS`, `GCM_INTERACTIVE=never`, `credential.interactive=false`). With Device Flow gone, no command, interactive or background, ever waits for user input for a credential.
- A private HTTPS clone with no credential the machine holds fails as an auth failure, with the `{auth}` reason class Phase 2 and 3 already produce (wording is Phase 6's).
- Restate for the outcome in PROJECT.md: AAP-D1 and the autoapply rules ("stored credentials only, no Device Flow") and D-PL8-12 become "git runs non-interactively with what the machine holds"; NFR-5's text and the `.planning/codebase/{STACK,ARCHITECTURE,CONVENTIONS}.md` lines that name Device Flow, `github-auth.ts`, `git-credential.ts`, `git-one-shot-credential.ts`, or `auth-host.ts` are updated.

### Migration notice (Q5, part)

- **D-SG-28: no runtime notice (upstream parity).** Upstream prints no such notice, and Pi stores no record of who used Device Flow. README.md and README.es.md (together, per the `readme` skill) and CHANGELOG.md (per the `changelog` skill) say that Device Flow is gone, how to authenticate now (`gh auth login` then `gh auth setup-git`, Git Credential Manager, or an ssh key), and how to remove the old Device Flow token by hand (`git credential reject` with `protocol=https`, `host=github.com`, `username=x-access-token`, or the user's keychain UI). The extension never runs `git credential reject` or deletes a stored credential itself.

### GitLab (Q5, part)

- **D-SG-29: GitLab token expiry is documented, not handled in code.** GitLab Device Flow tokens expire after about 2 hours, so a GitLab user loses access at the first expiry after the upgrade. README and CHANGELOG name this and the fix: `glab auth setup-git`, Git Credential Manager, or an ssh key. No GitLab-specific code or message.

### Claude's Discretion

- Plan split and order (for example: delete the threading first, then the modules, then the rule-pack and records), as long as `npm run check` stays green after every plan.
- Whether `orchestrators/auth-host.ts` keeps any non-Device-Flow job; delete it if none remains.
- Which existing scenarios that used Device Flow as a credential source switch to `credential.helper=store` in the sandbox `.gitconfig` (the harness already supports it, `features/step_definitions/git-host.steps.ts`), and which are deleted.

</decisions>

<specifics>

## Specific Ideas

Cucumber scenarios (AGENTS.md: each fails without the change):
- SG-AUTH-01: a private HTTPS marketplace and plugin install with a `credential.helper=store` entry succeeds with no prompt; with only `GITHUB_TOKEN` and `GH_TOKEN` set and no helper, the private clone fails as an auth failure, and the token value appears in no output, no recorded URL, and no git argument the stand-in sees.
- SG-AUTH-02: a private clone that fails auth shows no device code and runs no Device Flow request, on an interactive command, an autoapply load, and the background autoupdate pass.
- SG-AUTH-03: a helper entry shaped like a Device Flow token (`username=x-access-token`) keeps working for install and update over HTTPS, and stays in the helper after an auth failure the extension saw (the extension deletes nothing; git's own `credential reject` on a 401 is git's behavior, not the extension's).
- Tests never reach a real remote host and never run a real ssh.

</specifics>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 5 goal, notes (the deletion list), success criteria
- `.planning/REQUIREMENTS.md` — SG-AUTH-01..03
- `.planning/research/FEATURES.md` — E-SG-12 (background autoupdate and credentials), E-SG-13, anti-features (token in URL or header)
- `.planning/research/PITFALLS.md` — Pitfall 14 (dropping Device Flow), the `git-credential.ts` spawn pitfall, P-Auth
- `.planning/research/SUMMARY.md` — open question 2 and 5, the Phase 5 deliverables
- `.planning/PROJECT.md` — D-SG-05, D-SG-14, D-PL8-12, AAP-D1, NFR-5, D-79-04, D-79-05, D-BG-1101, D-BG-1102, GAUTH rows
- `.planning/phases/03-system-git-transport-and-clone-shape/` — D-SG-14 interim implementation and its evidence (`03-EVIDENCE.md` Q2 interim)
- `rule-packs/architecture.json`, `eslint.config.js` (BLOCK C `GIT_PROCESS_IMPORTERS`, BLOCK F `NETWORK_SEAMS`), `test/architecture/no-credential-leak.test.ts` (`CREDENTIAL_LEAK_TARGETS`)
- `.agents/skills/cucumber/SKILL.md`, `.agents/skills/readme/SKILL.md`, `.agents/skills/changelog/SKILL.md`

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- Harness credential arm: `credential.helper=store` in the sandbox `.gitconfig` (`features/step_definitions/git-host.steps.ts`) already serves system git; it replaces Device Flow as the private-source credential in scenarios.
- `platform/git-process.ts` already sets the non-interactive environment on every git command (D-SG-05).

### Integration Points

- 37 extension files name Device Flow, `credentialOps`, `authMemo`, or the auth modules; about 75 test and feature files do (grep `deviceFlow|device-flow|authMemo|credentialOps|git-one-shot-credential|auth-registry|github-auth`).
- `domain/github-auth.ts` is one of two `fetch` callers; removing it shrinks `fetch-chokepoint`.
- `platform/git-credential.ts` runs `git credential` through `git-process.ts`; deleting it narrows the importers of `git-process.ts` to `platform/git.ts`.

</code_context>

<deferred>

## Deferred Ideas

- Auth-failure message wording and any how-to-authenticate hint on the failure row: Phase 6 (failure-message parity), following upstream.

</deferred>

---

*Phase: 05-credential-surface*
*Context gathered: 2026-11-27*
