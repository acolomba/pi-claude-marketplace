---
phase: "2"
slug: "git-process-seam-and-typed-failures"
status: open_threats
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 1
asvs_level: 1
created: "2026-11-23"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Pi process → child processes | git, its helpers, ssh, and the package manager can outlive or block Pi | process tree, timeouts, cancellation |
| caller data → child stdin | the `git credential` request travels over stdin; an early exit raises EPIPE | credentials (password on approve) |
| child output → Pi memory, errors, logs | git, helper, ssh, and remote stderr can carry a URL with userinfo or a token; stderr decides the failure kind | stderr, cause chains, debug log |
| closed reason set → JSON consumers | the published schema is a contract | reason tokens (`git missing`) |
| Pi → the git binary | PATH and the working directory decide which file runs as git; the macOS xcrun shim can open the installer | executable path |
| user environment and git config → git child | variables and config can redirect git, prompt, or run programs | env, config, ssh command |
| repositories Pi does not own → git | hooks, fsmonitor, templates, credential helpers, `core.sshCommand`, rewrites, discovery | repository config |
| marketplace data → git argv | refs, URLs, and paths become operands | argv |
| git-source operation → network | with no usable git, nothing may reach the network or fall back | HTTP requests |
| remote → user's terminal | password, passphrase, and host-key prompts | prompts, host keys |
| scenario sandbox → developer machine | fixtures write a git config, programs, and a repository | test fixtures |
| codebase map and manual check → record | a stale chokepoint list or an unrun platform check | planning records |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Denial of service | `runProcess` timeout and abort | high | mitigate | SIGTERM, then SIGKILL, then a deadline (`platform/process-run.ts:186-224`); group signal, with the process alone for pid ≤ 1 or when the group cannot be signalled (`:317-340`); `taskkill /T /F` from `SYSTEMROOT\System32` (`:301-314`); POSIX `detached` (`:383`); the package manager runs through it (`platform/package-manager.ts:113`); real tree cases `test/platform/process-run.test.ts:843,864`, fake rows `:899-1031`. The real-Windows taskkill proof is deferred (T-02-40) | closed |
| T-02-02 | Denial of service | stdin write to an early-exiting child | medium | mitigate | `error` listener before write (`process-run.ts:352`); settles on `close` (`:282-287`); fake and real EPIPE cases `process-run.test.ts:309,824` | closed |
| T-02-03 | Denial of service | unbounded output | medium | mitigate | head or tail cap (`process-run.ts:158-173`); package manager 65,536 head (`package-manager.ts:93`); git stdout 8,388,608 head, stderr 65,536 tail (`git-process.ts:537-538`); `process-run.test.ts:368,396,539` | closed |
| T-02-04 | Elevation of privilege | a spawn without the chokepoint | high | mitigate | `process-run.ts:32-34` imports no child-process module; launcher is injected; the rule pack exempts `git-process.ts`, not `process-run.ts` (`rule-packs/architecture.json:111-121`); `fallow dead-code` green | closed |
| T-02-05 | Information disclosure | `GitCommandError.stderr` | high | mitigate | `this.stderr = redactCredentials(...)` (`shared/errors.ts:1372`); `test/shared/errors.test.ts:817-833` plants `alice:s3cret@` and asserts `***@` | closed |
| T-02-06 | Information disclosure | `GitCommandError.message` | high | mitigate | message holds the operation, kind, timeout limit, and exit code only (`errors.ts:1366,1380-1398`); operation is the subcommand plus the first Pi-owned option (`git-process.ts:802-804`); `errors.test.ts:782-804` | closed |
| T-02-07 | Spoofing | reason attribution | medium | mitigate | `GIT_FAILURE_ANSWERS … satisfies Record<…>` (`shared/git-failure-classifiers.ts:243-264`), `switch (answer)` with no default (`:300`), `GitCommandError` rung first (`:192`), `git-missing` → `git missing`; per-kind rows in `test/shared/git-failure-classifiers.test.ts` | closed |
| T-02-08 | Tampering | closed reason set drift | low | mitigate | commit `0b49c23` lands the token, wire enrollment (`notification-wire.ts:167`), types (`notification-types.ts:311`, `notify-reasons.ts:191`), regenerated schema, and locks together; `test/architecture/wire-schema.test.ts` green | closed |
| T-02-09 | Elevation of privilege | git lookup (binary planting) | high | mitigate | absolute PATH entries only (`git-process.ts:609-620`); absolute candidate spawned (`:693-706`); git's own PATH cut to absolute entries (`:658-661`); Windows cwd skip and batch-launcher refusal (`:715-740`, `process-run.ts:423-443`); `git-process.test.ts:625,820-915`. Windows rows are fake-host; the real-machine proof is deferred (T-02-40) | closed |
| T-02-10 | Information disclosure | prompt or askpass during a credential lookup | high | mitigate | `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never` (`git-process.ts:519-526`); `core.askPass=` and `credential.interactive=false` (`:220,242`); new session (`process-run.ts:383`); real-git E10 rows for `core.askPass`, `GIT_ASKPASS`, `SSH_ASKPASS` (`git-process.test.ts:1533-1572`); scenario `features/marketplace/git-source.feature:142-156` | closed |
| T-02-11 | Tampering | repository Pi runs in steering a credential lookup | medium | mitigate | neutral directory when no cwd (`git-process.ts:909`), ceiling at its parent (`:657`); real-git case `git-process.test.ts:1574-1603`; scenario `git-source.feature:161-175`. See UF-02-01 for the neutral directory itself | closed |
| T-02-12 | Elevation of privilege | hooks, fsmonitor, templates, ext and fd | high | mitigate | `configPairs` on every command (`git-process.ts:216-235`, applied at `:683`); `init.templateDir=` (`:239-244`); `GIT_TEMPLATE_DIR` removed (`:514`); real-git cases `git-process.test.ts:2275,2308` | closed |
| T-02-13 | Tampering | repository-pointer variables | medium | mitigate | the 12 `REMOVED_VARIABLES` (`git-process.ts:502-515`) are removed in every spelling (`:632-634`); `git-process.test.ts:668-730` | closed |
| T-02-14 | Denial of service | hanging helper or prompt | high | mitigate | shared launcher timeout (`git-process.ts:916-931`); `timeout` kind carries `timeoutMs` (`:821-823`); `CREDENTIAL_TIMEOUT_MS = 5_000` (`orchestrators/auth-host.ts:66`); `git-process.test.ts:1354` | closed |
| T-02-15 | Elevation of privilege | a second child-process importer | high | mitigate | commit `7ce5b31` changes the rule-pack exclude (`architecture.json:115-121`), `SHELL_OUT_EXEMPT_TARGETS` (`test/architecture/gate-targets.ts:226`), the whitelist test (`no-shell-out.test.ts:228`), and BLOCK C `GIT_PROCESS_ZONE` (`eslint.config.js:44-47,309-313,568-597`) together; the computed-config import-gate table (`no-shell-out.test.ts:62-85`); only `platform/git.ts:16` and `platform/git-credential.ts:44` import the module | closed |
| T-02-16 | Information disclosure | a credential in an error or a log | high | mitigate | operation is `credential <action>` (`git-credential.ts:110-116`); stderr redacted (`errors.ts:1372`); approve and reject log only `errorMessage(err)` (`git-credential.ts:231-234,256-259`); `sanitizeAttrValue` names the field only (`:124-130`); AUTH-09 scans `test/architecture/no-credential-leak.test.ts:382,408` | closed |
| T-02-17 | Spoofing | kind attribution from stderr | medium | mitigate | ordered `ROWS`, first match wins (`platform/git-failure-kind.ts:60-117`), with the Pitfall-6 order rows; corpus in `test/platform/git-failure-kind.test.ts` | closed |
| T-02-18 | Information disclosure | a credential in a git-process message or debug line | high | mitigate | the only debug line is `git version: ${versionLine}` (`git-process.ts:965`); AUTH-09 scan of `git-process.ts` (`no-credential-leak.test.ts:408`, target added in `gate-targets.ts`) | closed |
| T-02-19 | Denial of service | macOS installer dialog | medium | mitigate | `isXcrunShim` runs in `findGit` before any spawn (`git-process.ts:747-781`); darwin rows assert no launch before the verdict (`git-process.test.ts:972-1098`). The xcrun-file assumption (`:742-746`) awaits the real-Mac check (T-02-40) | closed |
| T-02-20 | Denial of service | a stale cached git | low | mitigate | `backstop` drops the entry on `git-missing` (`git-process.ts:872-889`), ENOENT/EACCES with git gone (`:785-798`), exit 127 and `xcrun: error:` (`git-failure-kind.ts:61-62`); `git-process.test.ts:1099-1189` | closed |
| T-02-21 | Tampering | a planted remote message steering the kind | low | accept | AR-02-01 | closed |
| T-02-22 | Tampering | silent fallback when git is missing | high | mitigate | `await NODE_GIT_PROCESS.locate()` first in `clone`, `fetch`, `resolveRemoteRef`, `listRemoteTags` (`platform/git.ts:574,621,697,769`), the only paths to isomorphic-git's `http` (`:551-559,591-593,634-636`); `test/platform/git.test.ts:905-942`; scenarios `features/marketplace/without-git.feature:7-20`, `features/plugin/without-git.feature:7-28` | closed |
| T-02-23 | Denial of service | gating a local verb | medium | mitigate | the seven local verbs call no lookup (`git.ts:650-957`); `git.test.ts:943`; dir, file, hosted, and local-plugin scenarios (`marketplace/without-git.feature:34-66`, `plugin/without-git.feature:36-54`) | closed |
| T-02-24 | Information disclosure | a scenario reaching the developer's git config or credentials | medium | mitigate | programs and config in the sandbox HOME (`features/lib/user-git-programs.ts:25-31,76-86`; `features/step_definitions/git-host.steps.ts:252,275`); project repository through the hermetic `runGit`; each Given registers a release; the no-git PATH is a run-owned temp dir (`features/support/world.ts:703`) | closed |
| T-02-25 | Elevation of privilege | a recording program left executable | low | mitigate | created with `wx` and `0o700` in the sandbox (`user-git-programs.ts:83-84`); release removes it (`:89-92`) | closed |
| T-02-26 | Tampering | argument injection through operands | high | mitigate | `SUBCOMMAND_RULES` (`git-process.ts:258-304`): `--end-of-options`, `--verify` for rev-parse, leading-dash refusal plus `--` for checkout, no operands for credential and version; refusal before lookup (`:902-905`); E7 rows `git-process.test.ts:1607-1763`; real-git `--upload-pack=` case `:2047` | closed |
| T-02-27 | Information disclosure | a network-free command reaching a transport | high | mitigate | local lane `GIT_ALLOW_PROTOCOL=/`, `GIT_SSH_COMMAND=false`, `LOCAL_LANE_PAIRS` (`git-process.ts:311-319,360-371`); real-git refusals of file, plain-path, https, scp, and helper URLs under the user's `always` config (`git-process.test.ts:1936-1960`) | closed |
| T-02-28 | Elevation of privilege | a user `GIT_ALLOW_PROTOCOL` that names `ext` | high | mitigate | network lane removes the variable (`git-process.ts:372-377`) and bans each omitted name (`:346-354`); `protocol.ext.allow=never` (`:221`); `git-process.test.ts:2076-2180`, real-git `ext::` cases `:2181-2235` | closed |
| T-02-29 | Elevation of privilege | repository hooks, fsmonitor, templates | high | mitigate | the D-SG-05 pairs and `GIT_TEMPLATE_DIR` removal (see T-02-12); real-git cases with positive controls `git-process.test.ts:2275-2358` | closed |
| T-02-30 | Tampering | discovery into another repository | high | mitigate | ceiling at the parent of the real cwd (`git-process.ts:909,657`), refused when it holds the PATH delimiter (`:911-913`), pointer removal (`:502-515`); `git-process.test.ts:2359-2442` | closed |
| T-02-31 | Denial of service | the lane refusing a legitimate local read | medium | mitigate | real-git `rev-parse`, `tag -l`, `config --get-all`, `update-ref`, `checkout` on the local lane (`git-process.test.ts:1979-2046`) | closed |
| T-02-32 | Elevation of privilege | a repository's own `core.sshCommand` | high | mitigate | ssh choice read in the neutral directory on the local lane (`git-process.ts:384-390,944-956`); composed `GIT_SSH_COMMAND` outranks every config scope (`:473-498`); real-git marker case `git-process.test.ts:2888` | closed |
| T-02-33 | Denial of service | password, passphrase, or host-key prompt | high | mitigate | forced variables (`git-process.ts:519-526`), `BatchMode=yes` (`:402`), `-batch` for plink and putty (`:396-400`), new session (`process-run.ts:383`); `git-process.test.ts:2955-3042` | closed |
| T-02-34 | Denial of service | git, helpers, or ssh left after a timeout | high | mitigate | group kill (`process-run.ts:317-340`); hold-arm and sleeping-ssh cases with `livingGroupMembers` (`git-process.test.ts:3043-3112`) | closed |
| T-02-35 | Spoofing | an unknown or changed host key | medium | mitigate | `StrictHostKeyChecking=yes` (`git-process.ts:402`); no `UpdateHostKeys` anywhere under `extensions/`; `known_hosts` writes per D-SG-03 (`02-CONTEXT.md:38`); `git-process.test.ts:3026` | closed |
| T-02-36 | Information disclosure | the user's ssh arguments in logs or messages | low | mitigate | no debug log of the command or the read (`git-process.ts:940-943`; the only log is at `:965`); a read error names `config --get-regexp` (`:802-804`) | closed |
| T-02-37 | Tampering | the user's ssh choice silently replaced | medium | mitigate | `[command, ...options]` keeps the user's command and arguments first (`git-process.ts:480-489`); precedence and variant rows `git-process.test.ts:2510-2682`; real-git `-i` case `:2861` | closed |
| T-02-38 | Tampering | a stale chokepoint description in the codebase map | medium | mitigate | 02-08 verify script re-run by the auditor, exit 0; `CONVENTIONS.md:68` and `ARCHITECTURE.md:237` name all five exempt files and not `git-credential.ts` | closed |
| T-02-39 | Repudiation | a deferred manual check nobody tracks | medium | mitigate | open `unrun-verify` entry #120 (`.planning/WINDOWS.md:137`). Caveat: `workflow.windows_enforce` is false, so the entry does not block `/gsd-ship` by itself | closed |
| T-02-40 | Denial of service | Windows lookup or macOS shim misfiring on a real machine | high | mitigate | checkpoint steps 1, 5, 6, 7, 8 not run; deferred to the PR (WINDOWS #120). Fake-host rows do not prove real-machine behavior | open |
| T-02-41 | Information disclosure | a credential dialog or prompt during a lookup | medium | mitigate | checkpoint steps 3, 4, 9, 10 not run; deferred to the PR (WINDOWS #120); the Linux behavior is proven under T-02-10 | open — below high threshold (non-blocking) |
| T-02-SC | Tampering | npm/pip/cargo installs (plans 02-01 to 02-08) | high | mitigate | `git diff --stat 6c34252 HEAD -- package.json package-lock.json` is empty; the 46-file diff has no dependency file | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-21 | A remote can print text that matches an unanchored kind row, through a `remote:` sideband line or an ssh server banner (`xcrun: error:`, the host-key texts, `Permission denied (publickey`). The exit-code rows (127, 129) cannot be spoofed. A sideband line cannot spoof the line-anchored rows, because git prefixes each one with `remote: `. The effect stays inside the closed reason set: a misleading reason, a dropped found-git cache entry (the next command looks git up again), and at most one `git version` debug read. No code runs and no credential moves (`platform/git-failure-kind.ts:60-97`). Re-check when the clone transport moves to system git: an `https-auth` kind may then drive the stored-credential reject path. | plan 02-04 (autonomous run; pending maintainer review) | 2026-11-23 |

---

## Unregistered Flags

| Flag | Severity | Finding | Suggested action |
|------|----------|---------|------------------|
| UF-02-01 | low | The neutral directory is `realpath(os.tmpdir())` (`platform/git-process.ts:909,1000`), on Linux usually the shared `/tmp`. The ceiling (`:657`) stops git from climbing, but git always inspects its own working directory. So a repository planted at the neutral directory itself by another local user would answer `git credential` (its `credential.helper` runs) and the ssh-config read (its `core.sshCommand` feeds `GIT_SSH_COMMAND`). The auditor reproduced this with a same-owner repository on git 2.43. Only git's ownership checks stop it (CVE-2022-24765 fix in 2.35.2, CVE-2022-29187 fix in 2.37.1, plus backports), and D-SG-06 probes no version. T-02-11 covers only an enclosing repository. | **Resolved** after the audit by code-review fix CR-01 (`36101c2`): git now runs from the Pi-owned, 0700, empty `<agentDir>/pi-claude-marketplace/git-neutral` (`platform/git-neutral-directory.ts`) with the ceiling at its parent, and `safe.bareRepository=explicit` on both lanes; real-git cases fail when the directory points at the shared parent or the pair is removed. |

---

## Notes (non-blocking)

- **Deferred platform proof.** The macOS and Windows branches (T-02-01 taskkill, T-02-09 Windows lookup, T-02-19 shim) are closed on code and fake-host rows only. Their real-machine proof is T-02-40 and T-02-41, tracked by WINDOWS #120. `workflow.windows_enforce` resolves to false, so #120 does not block ship by itself.
- **The credential binding passes the zone** (resolved after the audit by code-review fix WR-05, `8617ea5`: `CredentialGit` runs only `git credential fill|approve|reject`). `NODE_CREDENTIAL_GIT` (`platform/git-credential.ts:88`) passes the full `run` to `orchestrators/auth-host.ts`. The BLOCK C zone limits who imports `git-process.ts`, not who can run git through it. Every run is still hardened, and the eslint comment documents this.
- **POSIX lookup and Pi's cwd.** The POSIX lookup does not skip absolute PATH entries inside Pi's cwd, for example a `<project>/node_modules/.bin` that an npm script prepends. Only Windows skips them (upstream parity; residual of T-02-09).
- **The user's own ssh options win.** ssh keeps the first value it reads for each option, so an `-o StrictHostKeyChecking=no` or `-o BatchMode=no` in the user's own ssh command stays in force. This is by design (D-SG-05, T-02-37); it is a residual of T-02-33 and T-02-35.
- **Gaps in redaction.** `redactCredentials` does not mask an `Authorization: Basic` header, which a user's `GIT_TRACE_CURL` with `GIT_TRACE_REDACT=0` could print. `GitResult.stderr` on an allowed exit is returned unredacted. A `failed` cause keeps Node's `spawnargs`. No code renders any of these today, because cause chains render only redacted messages (`shared/errors.ts:199-201`).
- **`git missing` coverage.** Attribution of `git missing` on the update, reinstall, and fetch paths relies on the callers' one-level unwrap (`orchestrators/marketplace/update.ts:852-866`). Only add and install have unit and scenario cases. Wording parity belongs to Phase 6.

---

## Security Audit 2026-11-23

| Metric | Count |
|--------|-------|
| Threats found | 42 |
| Closed | 40 |
| Open | 2 (1 blocking: T-02-40; 1 below high: T-02-41) |

Auditor: gsd-security-auditor, ASVS L1, block_on high, tree at `651b0a2`, diff `6c34252..HEAD` (46 files outside `.planning`). All of these ran green:
- 727 platform and shared unit tests.
- 548 architecture and orchestrator tests.
- `wire-schema` and `compat-01`.
- Cucumber, adapter profile: `without-git` (11 scenarios) and `git-source` (31 scenarios).
- `eslint` on the key sources and `fallow dead-code` with the rule pack.
- The 02-08 codebase-map verify script.

The macOS and Windows checkpoint is not run (WINDOWS #120; the Windows branches the review fixes added are WINDOWS #121).

### Post-audit code-review fixes

After this audit, `02-REVIEW-FIX.md` fixed CR-01 (closes UF-02-01), CR-02 (D-SG-08), WR-01 (anchored kind rows; narrows AR-02-01: `remote:` lines no longer choose a kind), WR-02 to WR-06 and IN-02 (commits `36101c2`..`0745f86`). No threat changed status; T-02-40 and T-02-41 stay open until the platform check runs or the maintainer accepts them.
