---
phase: "9"
slug: "plugin-package-dependencies"
status: verified
# threats_open counts OPEN threats at or above workflow.security_block_on.
threats_open: 0
asvs_level: 1
created: "2026-10-29"
audited_commit: 1ef2b0ad126bfe8848a958f61a788c4959cbd60e
---

# Phase 9 — Security

> Fresh final merged-tree audit after the Phase 9 stale-verification review fixes and final Phase 6/8 convergence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin manifest files -> sanitizer and package manager | package.json and the selected lockfile determine the sanitized install | untrusted plugin JSON, dependency metadata, download URLs and integrity hashes |
| extension -> child process | the package runner starts npm or bun without a shell | a command and argv from a closed table; inherited Pi environment plus fixed extension-owned additions |
| package manager -> network | npm or bun fetches lockfile-pinned registry packages | sanitized exact versions, accepted download URLs and integrity hashes |
| package manager output -> user-visible notes | captured stderr/stdout becomes a local diagnostic | bounded, control-stripped text that passes through absolute-path redaction |
| state transaction -> package cleanup | disabled updates and uninstall may remove extension-owned node_modules | contained paths, an ownership marker and current locked state |
| scenarios -> loopback npm stand-in | Cucumber package installs use a local registry | deterministic test tarballs and an exact request log |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation and current evidence | Status |
|-----------|----------|-----------|----------|-------------|---------------------------------|--------|
| T-09-01 | Elevation of privilege | package-install.ts table rows | high | mitigate | Both runnable rows contain `--ignore-scripts`: `package-install.ts:71-103`. | closed |
| T-09-02 | Tampering | package-manager work directory | high | mitigate | `checkLockfile` creates a fresh staging directory and initially writes only `{}` as package.json; after sanitization, `installInWorkDir` writes only rewritten package.json and the selected lockfile: `package-install.ts:486-547`. No plugin `.npmrc` or bun configuration is copied. | closed |
| T-09-03 | Tampering | child-process launch | high | mitigate | Commands and argv originate in the closed lockfile table; the runner calls `spawn(command, args, {shell:false})`: `package-install.ts:71-103,507-520`, `package-manager.ts:297-323`. Plugin data cannot set argv or environment additions. | closed |
| T-09-04 | Denial of service | package manager while a state lock is held | medium | mitigate | Install and registry-query runners use 60 s and 30 s timeouts with a 5 s grace. `startKillTimers` sends SIGTERM, then SIGKILL, then reaches a bounded final deadline: `package-install.ts:123-164`, `package-manager.ts:164-243`. Parent closure after timeout does not cancel group escalation. POSIX groups and Windows task trees are handled at `package-manager.ts:254-323`. | closed |
| T-09-05 | Tampering | writes outside the extension root | high | mitigate | `detectInstall` calls `assertPathInside` before reading the lockfile or creating install output: `package-install.ts:298-375`. Package removal repeats containment on node_modules: `package-install.ts:668-687`. | closed |
| T-09-06 | Information disclosure | symlinked or oversized input files | medium | mitigate | `readBoundedFile` requires `lstat().isFile()` and enforces the 32 MB cap before reading: `package-install.ts:240-255`. | closed |
| T-09-07 | Information disclosure | package-manager output in notes | low | mitigate | Stream capture is capped and Unicode-safe: `package-manager.ts:144-161,193-243`. Notes are capped at 500 whole characters: `package-install.ts:127,232-238,378-409`. Discovery diagnostics apply `redactAbsolutePaths`: `staging-diagnostics.ts:104-128`. | closed |
| T-09-08 | Tampering | unsafe lockfile sources | medium | mitigate | The final phase decision reversed the original acceptance. `sanitizeLockfile` now rejects local/git/folder links, unsafe paths, non-exact entries, bad integrity, unsafe HTTP and forge URLs, overrides and patches, and rewrites only accepted fields: `domain/package-lockfile.ts:101-163,235-377,417-540,543-729`. npm receives a disabled git executable through `--git=<workDir>/git-is-disabled`: `package-install.ts:458-520`. | closed |
| T-09-09 | Repudiation | additional child-process importers | medium | mitigate | `child-process-chokepoint` permits exactly four reviewed files: `rule-packs/architecture.json:110-121`. The architecture test checks static, dynamic and require forms and pins the exact four-file set: `no-shell-out.test.ts:118-206`. ESLint allows imports of package-manager.ts only from the exact package-install seam: `eslint.config.js:529-548`. | closed |
| T-09-10 | Information disclosure | credentials in package-manager errors | low | accept | Claude Code’s secret redactor is not ported. Output is local, control-stripped, capped and absolute-path-redacted. This accepted limitation remains PKGDEP-03. | closed |
| T-09-11 | Denial of service | staging work directories left behind | low | accept | `runInstallStage` removes the work directory in `finally`; a failed removal is intentionally ignored and can cost disk only: `package-install.ts:550-569`. | closed |
| T-09-12 | Information disclosure | scenario npm reaching the public registry | high | mitigate | The package-file step requires an already-started registry: `plugin/packages.steps.ts:99-118`. `useNpmRegistry` first writes the sandbox `.npmrc` pointing to loopback: `world.ts:266-295`; the generated lockfile URLs also point to that stand-in. | closed |
| T-09-13 | Denial of service | scenario registry outliving a test | low | mitigate | The stand-in listens on `127.0.0.1` port 0 and its release closes all connections and the server: `npm-registry.ts:122-134,197-203`. World release also removes `.npmrc`: `world.ts:277-285`. | closed |
| T-09-14 | Tampering | temporary spike files | low | mitigate | Current-tree inspection found neither spike feature nor spike step-definition files and no Phase 9 spike artifact. The summary records the trap-backed clean-features verification. | closed |
| T-09-15 | Tampering | path-source or symlink-segment writes | high | mitigate | Every install or removal path must pass `assertPathInside`; a rejection returns the outside-root note without writing: `package-install.ts:298-375,668-687`. | closed |
| T-09-16 | Denial of service | losing working node_modules during update | medium | mitigate | Existing node_modules is parked under the work directory and restored if the replacement is absent or cannot move in: `package-install.ts:416-455`. | closed |
| T-09-17 | Tampering | parked packages visible beside plugin files | low | mitigate | The park path is `<workDir>/previous-node_modules`, outside the live plugin root: `package-install.ts:428-449`. | closed |
| T-09-18 | Information disclosure | local-folder note exposing an absolute path | low | mitigate | The note names the marketplace and command, not the absolute folder: `package-install.ts:307-324`. All discovery-warning surfaces still apply absolute-path redaction. | closed |
| T-09-19 | Tampering | update hook outside the swap lock | low | accept | The rename-based swap completes first; package failure remains a retryable note. This concurrency limitation remains explicitly accepted. | closed |
| T-09-20 | Tampering | fixture writes outside the sandbox publication | low | mitigate | `ownedTarget` rejects targets outside the publication and every multi-file package write passes through it: `published-marketplace.ts:404-418,719-735`. The lockfile fixture accepts only yarn.lock, pnpm-lock.yaml and bun.lockb: `plugin/packages.steps.ts:135-151`. | closed |
| T-09-21 | Tampering | temporary RED source edit committed | medium | mitigate | The final current tree contains the intended fixes and tests only; no spike or temporary RED file remains. Fresh full-gate execution passed on the current source. | closed |
| T-09-22 | Tampering | weakening a gate to obtain green | medium | mitigate | Review-fix inspection found no skipped tests or reduced threshold. The ESLint change narrows the package-runner exception to one exact importer and adds rejection cases. Fresh `npm run check` passed without bypass. | closed |
| T-09-23 | Repudiation | false green from a piped/background run | medium | mitigate | The orchestrator ran a fresh foreground `npm run check` on the exact final tree and observed exit 0: all static, integration and direct-coverage checks passed; 1,131 Cucumber scenarios and 11,561 steps passed; merged LCOV contains 309 records. | closed |
| T-09-24 | Information disclosure | later package scenarios reaching the public registry | high | mitigate | Scenarios capable of running npm start the loopback registry before publishing package files, and request-log assertions bind observed network use. Refused dir-marketplace cases start no npm process. | closed |
| T-09-SC | Tampering | dependencies installed by phase implementation | low | accept | `package.json` and `package-lock.json` have no change from the phase base `0483948f`; the implementation added no repository dependency. | closed |

---

## Post-Review Security Checks

| Review change | Threat mapping | Verification |
|---------------|----------------|--------------|
| Timed-out parent closes while a descendant survives | T-09-04 | `watchProcess` preserves kill timers after timeout, `startKillTimers` still sends group SIGKILL and reaches the final deadline. The regression at `package-manager.test.ts:444-476` observes the descendant being killed. POSIX fallback and Windows taskkill/deadline cases remain covered at `package-manager.test.ts:759-967`. |
| Disabled revision changes with old packages | T-09-05, T-09-15, T-09-16 | `refreshDisabledRecord` runs inside `withLockedStateTransaction`, removes packages before changing and saving the record, and throws before save when invalidation fails: `update-preflight.ts:771-834`. Removal requires containment and the regular ownership marker. Tests at `update-preflight.test.ts:752-834` cover success, retry after failure and compatibility-only retention. |
| Concurrent install during uninstall cleanup | T-09-05, T-09-15, T-09-16 | `removeUnusedPackages` acquires a fresh scope lock and performs the state reload, reference decision and removal inside one callback: `uninstall.ts:1102-1124`. Contention or cleanup failure is debug-only. The deterministic competing-install case at `uninstall.test.ts:7934-7988` retains usable packages and the new record. |
| Split UTF-8 package-manager output | T-09-07 | Each stream owns a `StringDecoder`, is flushed once and drops a cap-separated high surrogate: `package-manager.ts:144-161,193-243`. Tests at `package-manager.test.ts:216-281` cover split and incomplete sequences and both cap boundaries. |
| Narrow package-runner seam | T-09-09 | The exact-path ESLint exception retains all ordinary direction zones and rejects same-basename modules elsewhere: `eslint.config.js:518-548`, `no-shell-out.test.ts:14-57`. |

### Environment Clarification

The child process intentionally inherits the Pi process environment so npm and bun can use the user’s normal PATH, HOME, proxy and registry configuration. This is not a strict allowlist of inherited variables. The untrusted boundary remains closed because plugin content cannot populate `request.env`; the package-install consumer adds only the table-selected Bun cache directory, while the runner adds the fixed npm update-notifier setting: `package-install.ts:507-520`, `package-manager.ts:297-310`.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-09-10 | Claude Code’s secret redactor is not ported; diagnostics are local, bounded and path-redacted. | phase decision register | 2026-10-27 |
| AR-02 | T-09-11 | A failed staging cleanup can consume disk but cannot change the live plugin tree. | phase decision register | 2026-10-27 |
| AR-03 | T-09-19 | The post-swap package hook can race another update; failure is soft and a later update retries. | phase decision register | 2026-10-27 |
| AR-04 | T-09-SC | No repository dependency was added by the phase. | phase decision register | 2026-10-27 |

T-09-08 is no longer an accepted risk. The final phase implementation ports the sanitizer and disables git execution for npm.

---

## Threat Flags

All five plan summaries state that no security-relevant surface appeared outside the registered threat model. The stale-verification fixes map to existing T-09-04, T-09-05, T-09-07, T-09-09, T-09-15 and T-09-16 controls.

**Unregistered flags:** None.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-27 | 25 | 25 | 0 | original Phase 9 audit |
| 2026-10-29 | 25 | 25 | 0 | gsd-security-auditor, fresh L1 current-code audit after review fixes |
| 2026-10-29 | 25 | 25 | 0 | gsd-security-auditor, final L1 merged-tree audit at `1ef2b0ad`; exact full gate 1,143 scenarios / 11,742 steps / 309 LCOV; focused process/FIFO rerun 178/178 |

---

## Sign-Off

- [x] Every declared threat has a current disposition.
- [x] Every mitigation is present at its declared boundary.
- [x] Accepted risks are documented.
- [x] Review fixes preserve containment, ownership, process bounds and redaction.
- [x] Fresh final-tree `npm run check` passed.
- [x] `threats_open: 0`.
- [x] `status: verified`.

**Approval:** SECURED — 2026-10-29 at `1ef2b0ad126bfe8848a958f61a788c4959cbd60e`; 21 mitigated, 4 accepted, 0 transferred, and `threats_open: 0`.
