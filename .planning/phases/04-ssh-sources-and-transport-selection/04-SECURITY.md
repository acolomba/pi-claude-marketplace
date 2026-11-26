---
phase: "4"
slug: "ssh-sources-and-transport-selection"
status: secured
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-26"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| marketplace data → git address validator | a third-party `url`, `raw`, git-subdir `url`, and marketplace git address become git addresses | addresses |
| git address → git argv / ssh argv | an address's user and host reach the user's ssh through git | argv |
| Pi → the user's ssh | the probe (`ssh -T`) reaches github.com over TCP 22; `ssh -G` prints config and connects to nothing | process launch, network |
| Pi → the user's git and ssh settings | the skip checks read `GIT_SSH_COMMAND`, `GIT_SSH`, `core.sshCommand`, `insteadOf`, and ssh's config | configuration |
| GitHub base override → git `-c` pairs | a user value becomes an `insteadOf` key; an address prefix becomes its value | config pairs |
| first attempt → second attempt | a failed transport leaves staging behind and decides which credential the retry sends | directories, credentials |
| clone URL → notification | a user- or marketplace-supplied URL is printed and serialized in the D-SG-22 clone note | URLs (may hold userinfo) |
| test process / scenario sandbox → network | unit tests, auth-e2e, and scenarios run the production probe and SSH clones | network |
| records → reviewers | the NFR-5 text and the seam gate are what reviewers check the code against | policy text |

---

## Threat Register

Evidence lines are from the re-audit at `bd898e6`. The first audit ran at `efcae23`, and the review fixes (`8cf8f62`..`380ff1e`) were re-audited at `bd898e6`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Elevation of privilege | git-subdir `url` (F-2) | high | mitigate | `gitUrlRefusal` accepts only https, http, ssh, git+ssh, ssh+git, scp, host-less `file:` (`domain/git-url.ts:38-45,185-193,286-311`); applied to the git-subdir `url` (`domain/source.ts:296-301`), the url object `url` and `raw` (`:246,261`), and every scheme, `git@`, `file:`, or scp string (`:518-525,748-751`); `ext::` refused at parse (probe run), D-SG-05 `protocol.ext.allow=never` stays | closed |
| T-04-02 | Elevation of privilege | scp or ssh user/host smuggling an ssh option | high | mitigate | `(?!-)` on scp user and host and on ssh URL user and host (`git-url.ts:29,32,35,210-230`); URL and directory after `--end-of-options` (`platform/git-process.ts:357-360,385-387`); `-oProxyCommand=…@h:p`, `git@-o…:p`, `ssh://-o…/`, `ssh://h:-1/`, bracketed `-o` all refused (probe run) | closed |
| T-04-03 | Information disclosure | `file://host/share` UNC address | medium | mitigate | host, `//`, backslash, and decoded network-shaped paths refused (`git-url.ts:73-83,238-265`) | closed |
| T-04-04 | Information disclosure | validator refusal messages | low | mitigate | every shown address passes `redactCredentials` and control characters are escaped (`git-url.ts:94-101,190-192,228`) | closed |
| T-04-05 | Information disclosure | no-override scenario Pi leaving the machine (F-5) | medium | mitigate | `usePiWithProfile` refuses `withoutGitHubBaseOverride` without `httpsProxy` (`features/support/world.ts:885-892`) | closed |
| T-04-06 | Information disclosure | both-failed message and clone note URLs | medium | mitigate | both-failed message redacted whole (`shared/errors.ts:1440`); clone note URLs and retries redacted when recorded (`orchestrators/github-transport.ts:129-137`) and again when presented, for blocks and rows (`shared/notification-resolve.ts:398,417,429-437`) and plugin-info (`shared/notification-present.ts:232`); gate cases `test/architecture/no-credential-leak.test.ts:1041,1057,1072`; scenario `features/marketplace/url-source.feature:26` (fix `34ac832`) | closed |
| T-04-07 | Spoofing | retry rules reading stderr | medium | mitigate | `ssh-auth` `publickey` detail from a kind row matched after `remote:` lines are removed (`platform/git-failure-kind.ts:90,128,133,150`) | closed |
| T-04-08 | Tampering | closed wire schema | low | mitigate | `CLONE` is `additionalProperties: false` (`shared/notification-wire.ts:299-302`); `schema/claude-plugin.schema.json` regenerated; `test/architecture/wire-schema.test.ts` drift test | closed |
| T-04-09 | Spoofing | lookalike GitHub spellings | medium | mitigate | the fold refuses control and non-ASCII characters, `%00`, brackets, backslashes, `%` in the host, and scp `@` after `:` (`shared/github-base-url.ts:138-147,202,220`); the wire URL changes only under the base override | closed |
| T-04-10 | Tampering | base holding `=` breaking the insteadOf key | high | mitigate | `=` refused before any pair (`github-base-url.ts:89-91`); pair `url.<base>/.insteadOf=<prefix>` with the prefix as the value (`:354`); the `ssh+git://` prefix is computed from the folded `ssh:` form (`:287-299`, `bdb0dc0`), and a non-GitHub `ssh+git://` host gets no pair (probe run) | closed |
| T-04-11 | Tampering | folding cache keys | high | mitigate | `pluginCloneKey`, `pluginMirrorKey`, `canonicalCloneUrl` unchanged (`domain/clone-key.ts:39-60,86-88`); the fold is used in comparisons only (`:116-152`) | closed |
| T-04-12 | Repudiation | two records merging silently | low | accept | AR-04-01 | closed |
| T-04-13 | Elevation of privilege | the ssh probe launch | high | mitigate | spawned only from `platform/git-process.ts` (no new `child_process` importer); fixed argv `-T -o BatchMode=yes -o ConnectTimeout=2 -o StrictHostKeyChecking=yes git@github.com` (`git-process.ts:706-718`); absolute-PATH lookup, `ssh.exe` only on Windows (`:1010-1019`); neutral cwd (`:1268-1300`); `shell: false`, stdin `ignore`, detached group, group kill (`platform/process-run.ts:159,419-421`) | closed |
| T-04-14 | Information disclosure | probe debug lines | medium | mitigate | the line holds exit code and verdict only; a thrown message is path-redacted (`platform/git.ts:936-950`); `ssh()` logs nothing | closed |
| T-04-15 | Information disclosure | a test reaching github.com:22 | high | mitigate | refusing `ssh` first on PATH for every `node --test` entry (`scripts/isolated-pi-home.mjs:41-64`; `scripts/test-coverage-direct.mjs:14`); pinned by `test/orchestrators/marketplace/shared.test.ts:374-380`; scenarios use the stand-in first on PATH (`features/support/pi-process.ts:34-38,74`) | closed |
| T-04-16 | Tampering | staging between add attempts | medium | mitigate | `beforeRetry` clears staging through the add's removal ops (`orchestrators/marketplace/add.ts:1055,1081`); a failed clear throws the first failure and runs no retry (`orchestrators/github-transport.ts:187-201`, `7b47359`) | closed |
| T-04-17 | Denial of service | probe holding a command | low | mitigate | `ConnectTimeout=2`, 3000 ms limit, group kill (`git-process.ts:710-718`); a timed-out probe reads as `unknown` (`git.ts:904-921`) | closed |
| T-04-18 | Tampering | network-free modules naming the probe | medium | mitigate | `DEFAULT_GITHUB_SSH_OPS` in `NETWORK_SEAM_NAMES` (`eslint.config.js:108-109`); named only in seams (`marketplace/{add,shared,update}.ts`, `plugin/update-flow.ts`). See R-04-1 | closed |
| T-04-19 | Spoofing | stand-in diverging from real ssh | low | accept | AR-04-02 | closed |
| T-04-20 | Tampering | skip checks reading Pi's own hardening | high | mitigate | `userSshOverride` reads Pi's start environment and the user's `core.sshCommand` (`git.ts:983-1007`; `marketplace/shared.ts:266`); `--get-url` runs on the local lane with no request pair (`git.ts:1014-1031`) | closed |
| T-04-21 | Elevation of privilege | the `-G` launch | medium | mitigate | fixed argv `-G git@github.com`, 5000 ms (`git-process.ts:720`); same lookup, cwd, stdin, and group kill as the probe | closed |
| T-04-22 | Information disclosure | `-G` output and debug lines | medium | mitigate | output parsed to a boolean and dropped (`git.ts:1057-1080,1092-1117`); debug lines hold the exit code only (`orchestrators/github-transport.ts`, the `urlRewrittenOnce` and `sshHopChecks` helpers) | closed |
| T-04-23 | Tampering | partial clone surviving a failed attempt | medium | mitigate | `beforeRetry` removes staging (`plugin/clone-cache.ts:139`); only the clone retries, `fetchCommit` and `checkout` do not (`:179-217`); `HEAD` must equal the pin (`:214`) | closed |
| T-04-24 | Information disclosure | a scenario reaching github.com | high | mitigate | no-override profile requires the CONNECT proxy (`world.ts:885-892`); scenario `GIT_SSH_COMMAND`/`GIT_SSH`/`core.sshCommand` admit only `ssh` or empty (`features/step_definitions/git-host.steps.ts:440-446`); allowlist child environment (`features/lib/pi-rpc.ts`); the stub serves only registered hosts (`features/lib/ssh-git-host/stub.ts:166-170`) | closed |
| T-04-25 | Information disclosure | the add's note URL | medium | mitigate | github.com terms under the override (GHB-04); credentials redacted as T-04-06; scenario `features/marketplace/url-source.feature:26` | closed |
| T-04-26 | Repudiation | mass re-baseline hiding a regression | medium | mitigate | rebaseline rule and audit (04-08-SUMMARY "Rebaseline rule", "Rebaseline audit") | closed |
| T-04-27 | Tampering | closed wire schema | low | mitigate | no schema change in 04-08; `clone` from 04-02's closed object | closed |
| T-04-28 | Tampering | memo key reuse across transports | low | mitigate | each attempt reads and writes under the sent URL, success only (`plugin/dependency-tag-probe.ts:129,139`); a successful HTTPS retry is also kept under the SSH address of the same `owner/repo` (`:205,217`, `380ff1e`), so an entry never answers for another repository | closed |
| T-04-29 | Information disclosure | SSH tag listing from a test | high | mitigate | as T-04-15 and T-04-24; unit tests use the listing seams | closed |
| T-04-30 | Denial of service | no-key user's constrained install | low | accept | AR-04-03 | closed |
| T-04-31 | Tampering | planted `origin` redirecting refreshes | medium | mitigate | refresh plans come from the declared source (`marketplace/clone-swap.ts:134-158`); legacy `.json` url arm still reads origin (`:107-121`, R-04-3) | closed |
| T-04-32 | Tampering | half-written staging between refresh attempts | medium | mitigate | `beforeRetry` clears staging (`clone-swap.ts:480`); only a complete clone is swapped; failure choice in `refreshFailure` (`:447`) | closed |
| T-04-33 | Denial of service | a refresh probing twice | low | accept | AR-04-04 | closed |
| T-04-34 | Elevation of privilege | the `-G` tail | medium | mitigate | closed field mapped to the literal ` -G >&2` (`git-process.ts:604-606,643`); accepted only on a network-lane `ls-remote`, else refused before spawn (`:611-617,1166`) | closed |
| T-04-35 | Spoofing | stderr steering the Windows retry | medium | mitigate | `isKeyFailure` reads the typed kind and detail only (`domain/github-plugin-transport.ts:155-166`) | closed |
| T-04-36 | Repudiation | Windows behavior unproven on Windows | medium | transfer | `[system-git]` `unrun-verify` entry 128, open (`.planning/WINDOWS.md:145`) | closed |
| T-04-37 | Tampering | context leaking across commands | low | mitigate | contexts made per call (`orchestrators/github-transport.ts:467-489`; `plugin/update-flow.ts:565,1049,1784`; `edge/handlers/marketplace/update.ts:66`; `marketplace/background-pass.ts:419`); no module-level context | closed |
| T-04-38 | Tampering | ls-remote and clone on different repositories | medium | mitigate | a pin is the source's `sha` only, with no remote read (`clone-cache.ts:1013-1023`, `08c1f0e`); `HEAD` checked after the clone (`:214`) | closed |
| T-04-39 | Information disclosure | a scenario reaching github.com | high | mitigate | as T-04-24 | closed |
| T-04-40 | Information disclosure | refresh note URL | medium | mitigate | github.com terms (GHB-04); refresh notes are recorded by the same runner, so `recordNote` and `resolveRows` redact them (T-04-06) | closed |
| T-04-41 | Repudiation | mass re-baseline | medium | mitigate | 04-13-SUMMARY "Rebaseline audit" and split verifier | closed |
| T-04-42 | Information disclosure | plugin note URL | medium | mitigate | github.com terms (GHB-04); plugin url-source notes (`github-plugin-transport.ts:82-90,245,250`) are redacted as T-04-06 | closed |
| T-04-43 | Spoofing | note on the wrong row | low | mitigate | notes keyed by subject (`orchestrators/github-transport.ts:47-55,79-82,326`); per-scope note views (`8cf8f62`); cascade and results unit cases | closed |
| T-04-44 | Repudiation | mass re-baseline | medium | mitigate | 04-14-SUMMARY "Rebaseline audit" | closed |
| T-04-45 | Information disclosure | update and reinstall note URLs | medium | mitigate | github.com terms (GHB-04); redacted as T-04-06 | closed |
| T-04-46 | Tampering | new plugin-info wire member | low | mitigate | optional `clone: Type.Optional(CLONE)` (`notification-wire.ts:502`); schema regenerated; drift test | closed |
| T-04-47 | Repudiation | mass re-baseline | medium | mitigate | 04-15-SUMMARY "Rebaseline audit" | closed |
| T-04-48 | Tampering | context reused by a later run | low | mitigate | new context per `applyReconcile` and per import run (`reconcile/apply.ts:2562,2611`; `import/execute.ts:2530`) | closed |
| T-04-49 | Information disclosure | apply's network use under autoapply | medium | mitigate | probe reachable only from clone, remote-list, and tag steps (`marketplace/add.ts:1045`, `clone-swap.ts:145`, `clone-cache.ts:137`); `info` makes no context without `--fetch` (`plugin/info.ts:275`); `index.ts`, `reconcile/load.ts`, `list-flow.ts`, `uninstall.ts`, `marketplace/remove.ts` unchanged in this phase | closed |
| T-04-50 | Repudiation | mass re-baseline | medium | mitigate | 04-17-SUMMARY "Rebaseline audit" | closed |
| T-04-51 | Repudiation | NFR-5 text out of step | medium | mitigate | `AGENTS.md:60` byte-identical to `.planning/PROJECT.md`'s NFR-5 line, naming the probe, retries, `-G`, `--get-url`, tag reads; `NETWORK_SEAMS` count 19 | closed |
| T-04-52 | Information disclosure | auth-e2e SSH retry reaching github.com:22 | high | mitigate | stand-in first on PATH and every launch asserted (`test/integration/auth-e2e.test.ts:125-145,248`) | closed |
| T-04-53 | Tampering | shell `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` / `CLAUDE_CODE_REMOTE` reaching a scenario Pi | low | mitigate | `INHERITED_VARIABLES` plants both and the case pins they reach no Pi (`test/architecture/hermetic-git-environment.test.ts:66,98,482-509`) | closed |
| T-04-54 | Information disclosure | HTTPS retry of a `github` dependency's tag listing | medium | mitigate | only `github` kind, only after a failed SSH listing, never after git-missing or abort (`dependency-tag-probe.ts:162-170,205-217`); bundle from `buildCloneAuth` of the canonical identity (`:196`) | closed |
| T-04-55 | Tampering | context shared across commands, or an enable member probing alone | low | mitigate | fetch, `info --fetch`, enable roots make their own context (`plugin/fetch.ts:173`, `info.ts:290`, `enable-disable.ts:2757`); one object for root and members (`enable-disable.ts:474,1062`) | closed |
| T-04-56 | Information disclosure | a scenario reaching github.com | high | mitigate | as T-04-24 | closed |
| T-04-57 | Tampering | unplanned single attempt or SSH-only arm | low | mitigate | `transport` required on the four network entry points (`clone-cache.ts:128,271,408,456,554,662,688`) and `checks` required (`github-plugin-transport.ts`); `resolvePluginPin` sends nothing (`:1013`); `@ts-expect-error` proofs (`test/orchestrators/plugin/clone-cache.test.ts:1200-1210`) | closed |
| T-04-58 | Information disclosure | fetch, `info --fetch`, enable note URLs | medium | mitigate | github.com terms (GHB-04); rows redacted by `resolveRows`, plugin-info by `redactPluginInfo` (T-04-06) | closed |
| T-04-59 | Repudiation | mass re-baseline | medium | mitigate | 04-16-SUMMARY "Rebaseline audit" | closed |
| T-04-SC | Tampering | npm installs | high | mitigate | `package.json` and `package-lock.json` unchanged `42fe92e..bd898e6` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-12 | the fold runs in comparisons only; two records that fold to one make `recordedSourceAction` find two matches and run a fresh add (`orchestrators/marketplace/add.ts:653-659`) | phase orchestrator (plan threat model) | 2026-11-26 |
| AR-04-02 | T-04-19 | the stand-in's texts come from upstream's classifier and its transport refusals match its probe answers; a real-ssh check stays manual (04-VALIDATION Manual-Only) | phase orchestrator (plan threat model) | 2026-11-26 |
| AR-04-03 | T-04-30 | D-SG-20 accepts the TAGS-02 current-copy result for a path-source dependency; a `github`-source dependency retries over HTTPS and still pins the tag | phase orchestrator (plan threat model) | 2026-11-26 |
| AR-04-04 | T-04-33 | two probes per stale refresh, as upstream; each bounded at 3000 ms; the memo is a deferred idea | phase orchestrator (plan threat model) | 2026-11-26 |

## Transferred Risks

| Threat Ref | Transferred To | Reference |
|------------|----------------|-----------|
| T-04-36 | the manual Windows check at the pull request | `.planning/WINDOWS.md` entry 128 (`[system-git]` `unrun-verify`, open) |

## Open Findings (below `block_on`)

| ID | Severity | Finding | Owner |
|----|----------|---------|-------|
| F-04-1 | medium | **fixed** in `34ac832`: clone note URLs and retries were shown unredacted in text and JSON; now redacted at record and at presentation (T-04-06, -25, -40, -42, -45, -58 closed) | closed 2026-11-26 |
| R-04-1 | info | `defaultPluginTransportContext` (`orchestrators/marketplace/shared.ts:276-280`) binds the default probe under a name BLOCK F does not match, so non-seam modules (and `edge/handlers/marketplace/update.ts`, `marketplace/background-pass.ts`) name it by design; the context probes only when a clone step asks, but the gate would not catch a future `list` that probed | follow-up |
| R-04-2 | info | unit-test processes keep the shell's `GIT_SSH_COMMAND` and `GIT_SSH` (`scripts/isolated-pi-home.mjs` strips only `GIT_CONFIG_*`); today the only git-run ssh in a unit test carries `-G`, which connects to nothing | follow-up |
| R-04-3 | info | a legacy url record whose URL ends in `.json` still refreshes from the checkout's recorded origin (04-09 deviation 1; `clone-swap.ts:107-121`) | follow-up |
| R-04-4 | info | D-SG-17 admits plain `http://` git sources (maintainer parity choice); review IN-A-02 (skipped) notes the clone is labelled HTTPS | recorded decision |
| R-04-5 | info | review IN-A-01 (skipped): an `owner/repo` source is not checked against upstream's repository pattern, so `evil:x/y` builds `git@github.com:evil:x/y.git`; the host stays github.com and operands sit after `--end-of-options`, so argv stays safe | follow-up |

Phase 3 carry-overs: F-2 closed by T-04-01; F-5 closed by T-04-05.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-26 | 60 | 54 | 6 (medium, below `block_on: high`, non-blocking; F-04-1) | gsd-security-auditor at `efcae23` |
| 2026-11-26 | 60 | 60 | 0 | gsd-security-auditor re-audit at `bd898e6` (F-04-1 fixed in `34ac832`; review fixes `8cf8f62`..`380ff1e` spot-checked, no regression) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: secured` set in frontmatter

**Approval:** secured 2026-11-26
