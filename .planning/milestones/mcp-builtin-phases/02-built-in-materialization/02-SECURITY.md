---
phase: "2"
slug: "built-in-materialization"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
register_authored_at_plan_time: true
created: "2026-11-04"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register comes from the `<threat_model>` blocks of `02-01-PLAN.md` to
> `02-09-PLAN.md`: threats T-02-01 to T-02-37, plus one `T-02-SC` (supply chain)
> row per plan, so the register has 46 rows. The gsd-security-auditor verified
> each row at ASVS level 1 on 2026-11-04 against `features/mcp-builtin-phase-2`
> (HEAD `7802eec`, clean tree), with block-on `high`. Line numbers below are for
> that tree. The auditor also ran the phase's unit and conformance tests on it
> (10 files, 249 tests, 0 failures); it did not re-run the cucumber profiles.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin config to Pi's resolver | A plugin's `env` and `headers` values reach Pi's `resolve-config-value.js`, which expands `$NAME` and runs a leading `!` as a shell command | plugin-controlled strings, resolved secrets |
| state.json to file reads | `record.resolvedSource` feeds `${CLAUDE_PLUGIN_ROOT}`, the legacy reader, and the description reader | recorded paths |
| session environment to Pi's registry | Resolved values, credentials included, sit in Pi's session registry | resolved env and header values |
| active implementation to registration | A registration under the adapter, or under no implementation, is a proxied duplicate or an extension error | server names and configs |
| plugin values to the server process | The registered `env`, `headers`, and `args` pass Pi's resolver and the stdio spawn | resolved values |
| plugin config to Pi's registry | OAuth fields and Pi-only powers a plugin could set | `oauth`, `auth`, `cwd`, `toolExposure`, `enabled` |
| user and project mcp.json files to info | info reads files the user or a project wrote | server names only |
| Pi's tool list to info | The status reader trusts Pi's `namespace` and `exposure` fields | tool inventory |
| project files to Pi's process | A project-scope plugin's server is a process the project's state asks Pi to start | project records |
| plugin commands to the next session | A verb changes records; the next load turns records into running processes | records |
| user's Pi settings and companions to the active implementation | The user's choice decides which implementation runs plugin servers | settings, companion list |
| plugin-declared server names to Pi's registry | A plugin chooses the names that become registered and tool names | server names |
| test harness to the sandbox | Launch variable, loopback stand-in, config probe, and the earlier-record rewrite live in the run's sandbox | test fixtures |
| the doc to the user's security decisions | Users choose an implementation and trust settings from what `docs/mcp-compatibility.md` says | documentation |
| the merged tree to the milestone branch | The phase gate is the last proof before the parent merges the phase | gate results |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Elevation of privilege | `BUILTIN_FIELD_ENCODER` on `env`/`headers` | high | mitigate | `bridges/mcp/builtin-escape.ts:35-48` doubles every `$` (function replacer) and writes a leading `!` as `$!`; `substitute.ts:134-138,156-159` routes every `env` and `headers` value, and the injected `CLAUDE_PLUGIN_ROOT/DATA`, through it as a secret field. Pi resolves only `env`, `headers`, and `oauth.clientSecret` (`dist/extensions/mcp/runtime.js:56-62,157`). Unit rows `test/bridges/mcp/builtin-escape.test.ts:71-97,123-143`; conformance through Pi's real resolver, `getConfigValueEnvVarNames` empty and `isCommandConfigValue` false, `test/integration/mcp-builtin-encoding-conformance.test.ts:164-223` (`$HOME`, `$$`, `$!`, `!cmd`) | closed |
| T-02-02 | Tampering | `record.resolvedSource` (UF-1) | high | mitigate | `orchestrators/mcp/builtin-registration-step.ts:124-188` (`cloneKeyOf`, `owningRoot`, `isContained` over `assertPathInside`); `recordRegistrations` calls it first (`:226`), before the legacy reader (`:233`) and the description read (`:243-252`); a refusal returns no registration. Tests `test/orchestrators/mcp/builtin-registration-step.test.ts:486-631` (own clone entry, wrong clone entry, no commit, cloned marketplace outside its checkout, `..` at `:589`, symlink at `:609`). Resolves Phase 1 advisory UF-1 | closed |
| T-02-03 | Information disclosure | resolved values in `getMcpServers()` | medium | accept | P2-DC-02: the same Pi process already holds `process.env`; nothing is persisted (D-MB-04). Stated to users in `docs/mcp-compatibility.md:189,606`. Accepted risk AR-02-01 | closed |
| T-02-04 | Information disclosure | debug log of a refused registration | medium | mitigate | `builtin-registration-step.ts:106-108` passes every line through `redactAbsolutePaths`; `bridges/mcp/builtin-registration.ts:30,77` log the server name and Pi's message only. Pi's validator messages name servers and tools, never values (`dist/core/mcp-servers.js:136-215`). Channel is opt-in (`PI_CLAUDE_MARKETPLACE_DEBUG=1`, `shared/debug-log.ts:22-26`). Test `builtin-registration-step.test.ts:754-778` | closed |
| T-02-05 | Elevation of privilege | Pi-only powers in a plugin config (`auth.provider`, `cwd`, `toolExposure`, `enabled`, `clientSecret`, `clientName`, `clientRegistration`) | high | mitigate | Closed table: `domain/mcp-builtin-translation.ts:25,31-33,46-61,75-88` copies only `type`, five transport fields, four mapped `oauth` keys, `timeout`, `exposure`, `description`; `domain/mcp-server-features.ts:103-137` drops `clientSecret` and the rest. Test `test/domain/mcp-builtin-translation.test.ts:117-147` | closed |
| T-02-06 | Spoofing / Denial of service | registration under adapter or none | high | mitigate | MSEL-03 gate `builtin-registration-step.ts:312-315` returns before any context, state, or Pi read; the only Pi calls sit in `syncBuiltinRegistrations`, reached only after it. Strict-mock tests `builtin-registration-step.test.ts:195-208` (adapter, none); adapter twin `features/mcp-server/listing.feature:147-163` | closed |
| T-02-07 | Elevation of privilege | an untrusted project's servers | high | mitigate | `builtin-registration-step.ts:303-310,320-323`: `ctx.isProjectTrusted()` is read on every sync and the project scope is loaded only when true (`["user"]` otherwise); `syncSession` is the sole caller path (`index.ts:192`, `session-materialize.ts:47-49`). Tests `builtin-registration-step.test.ts:229-270` (trusted, trust asked per call), `:365-382` (untrusted) | closed |
| T-02-08 | Information disclosure | persisting resolved values | high | mitigate | No write call or write import in any built-in file (grep clean); `loadState(..., { persistMigration: false })` at `builtin-registration-step.ts:286` (`persistence/state-io.ts:597` skips the save); rule-pack `write-file-atomic-chokepoint` (`rule-packs/architecture.json`) exempts only `shared/atomic-json.ts`, `bridges/mcp/stage.ts`, `orchestrators/plugin/prune-rollback.ts`. Owner and replaced-name state in `platform/mcp-builtin-status.ts:76,90` is in memory and holds names only | closed |
| T-02-09 | Denial of service | one bad server aborting all registrations | medium | mitigate | Per-call try/catch `bridges/mcp/builtin-registration.ts:26-31,69-78`; per-record `builtin-registration-step.ts:267-279`; per-scope `:284-290`; whole-sync `:317-334`; callers `index.ts:190-195`, `session-materialize.ts:29-35`. Tests `builtin-registration.test.ts:187,220`, `builtin-registration-step.test.ts:384-426,735-752,780-795` | closed |
| T-02-10 | Elevation of privilege | a plugin `env` value starting with `!` or holding `$NAME` under real Pi | high | mitigate | Builtin-only outline rows `!echo pwned` and `cost $5 and $HOME` at `features/mcp-server/configuration.feature:287-326` run through Pi 1.5.0; red run with escaping removed made `!echo pwned` run a shell (02-02-SUMMARY, 02-08-SUMMARY:140). Same property in the conformance test (T-02-01) | closed |
| T-02-11 | Information disclosure | the launch variable in `pi-launch-environment.jsonl` | low | accept | Test-only values in the run's sandbox, removed by the release and the next reset. Accepted risk AR-02-02 | closed |
| T-02-12 | Tampering | the loopback http stand-in | low | accept | Listens on `127.0.0.1` only (`features/lib/mcp-server-http.ts:27,184`) and is closed by the scenario's release (`:203-213`). Accepted risk AR-02-03 | closed |
| T-02-13 | Elevation of privilege | Pi-only powers (`auth.provider`, `cwd`, `toolExposure`, `enabled`) | high | mitigate | "Pi-only fields never reach Pi" scenario `features/mcp-server/builtin-values.feature:60-81` asserts the registered config holds none; unit twin `test/domain/mcp-builtin-translation.test.ts:117-147` | closed |
| T-02-14 | Information disclosure | `clientSecret` and a custom `clientName` | high | mitigate | OAuth scenario `builtin-values.feature:26-58` asserts the exact four-key `oauth` object (`clientId`, `callbackUrl`, `authServerMetadataUrl`, `scope`) with `clientSecret`, `clientName`, `clientRegistration` in the input; code `domain/mcp-server-features.ts:103-137` | closed |
| T-02-15 | Information disclosure | the probe's report of resolved values | low | accept | Harness-only extension, loaded through `extraExtensions` by `@builtin-only` scenarios; the values are fixtures (`features/lib/mcp-builtin-config-probe/extension.ts`). Accepted risk AR-02-04 | closed |
| T-02-16 | Spoofing | an OAuth metadata fetch leaving the machine in a test | medium | mitigate | Remote values use `127.0.0.1:9` (`builtin-values.feature:37,43`; `mcp-builtin-encoding-conformance.test.ts:238-242`), where nothing listens | closed |
| T-02-17 | Tampering | reading an untrusted project's `.pi/mcp.json` | medium | mitigate | `orchestrators/plugin/info-mcp-status.ts:154-157` adds the project file only while `lookup.projectTrusted`. Test `test/orchestrators/plugin/info-mcp-status.test.ts:588-602` | closed |
| T-02-18 | Denial of service | a synchronous read that throws inside the frozen info call | medium | mitigate | `bridges/mcp/builtin-overrides.ts:29-45` wraps read and parse in try/catch and returns no names. Tests `test/bridges/mcp/builtin-overrides.test.ts:24-67` (empty, invalid, comments, non-object, absent, directory); `info-mcp-status.test.ts:604-618` | closed |
| T-02-19 | Spoofing | an mcp.json server holding the plugin server's namespace looks connected | medium | mitigate | `info-mcp-status.ts:192-197` stamps `overridden by mcp.json` before the reader is asked. Test `info-mcp-status.test.ts:543-568` (strict reader mock); scenario `features/mcp-server/builtin-status.feature:129` | closed |
| T-02-20 | Information disclosure | info names a user mcp.json server | low | accept | Info shows only this extension's own server names and a fixed token; the mcp.json read yields a name set used for membership only (`builtin-overrides.ts:58-60`). Accepted risk AR-02-05 | closed |
| T-02-21 | Elevation of privilege | an untrusted project's plugin server starts a process | high | mitigate | Same gate as T-02-07 (`builtin-registration-step.ts:307,322`). Untrusted twin `features/mcp-server/project-scope.feature:146-168` (registry holds only the user-scope server) and `builtin-trust.feature:8-37`; red run with trust forced true showed the project server registering (02-05-SUMMARY, runs 5 and 6) | closed |
| T-02-22 | Spoofing | an untrusted project's record replaces the user's server of the same name | high | mitigate | Project record applies only while trusted (`builtin-registration-step.ts:307`; per-name precedence `:303-310`, tested `builtin-registration-step.test.ts:270-364`). `builtin-trust.feature:8-37` shows the user data directory under distrust, `:39-75` the project directory when trusted; red run with trust forced true showed the project data directory (02-05-SUMMARY) | closed |
| T-02-23 | Information disclosure | the echoed plugin root and data paths in a model result | low | accept | Sandbox fixture paths, projected to run tokens in the scenarios. Accepted risk AR-02-07 | closed |
| T-02-24 | Elevation of privilege | a disabled or uninstalled plugin's server keeps starting in later sessions | high | mitigate | Enabled filter `builtin-registration-step.ts:110-121` (`isRecordedButDisabled`, `dependencyDisabled`); unregister of every `plugin_` name the desired set lacks, `bridges/mcp/builtin-registration.ts:56-61`. Next-session scenarios `features/mcp-server/lifecycle.feature:57-68,96-107` assert an empty registry; unit `builtin-registration-step.test.ts:633-647`, `builtin-registration.test.ts:118-139` | closed |
| T-02-25 | Tampering | a marketplace change reaches a session without an update | medium | mitigate | Registration reads the record only: `recordedMcpServers` (`builtin-registration-step.ts:233`, `orchestrators/mcp/recorded-servers.ts:46-65`); the legacy reader is pinned to the recorded root and version (`recorded-servers.ts:117-140`). Scenario `lifecycle.feature:272-300` returns `echo:ping` | closed |
| T-02-26 | Repudiation | autoapply registers a server the user did not install by hand | low | accept | Autoapply is the user's setting, default off (`persistence/config-merge.ts:249-262`); its load report names each install. Accepted risk AR-02-08 | closed |
| T-02-27 | Spoofing / Denial of service | a server registered with Pi while the adapter serves it too | high | mitigate | MSEL-03 gate (T-02-06). Last adapter leg `features/mcp-server/implementation-switch.feature:102-108` asserts an empty registry; `listing.feature:147-163` | closed |
| T-02-28 | Elevation of privilege | a registration under no implementation, which Pi reports as an extension error | high | mitigate | MSEL-03 gate. No-implementation leg `implementation-switch.feature:79-86` asserts no extension error and an empty registry; red run without the gate failed on Pi's `register_mcp_server` extension error (02-08-SUMMARY:145) | closed |
| T-02-29 | Tampering | the extension turning built-in MCP back on by editing Pi settings | high | mitigate | No Pi settings write exists in `extensions/` (grep for settings writers and `builtin:mcp` finds only the read-only detection at `platform/pi-api.ts:304-333`); COVERAGE.md opts out of writing `mcp.json` or Pi settings (D-MB-01). The harness restart step takes the user's step | closed |
| T-02-30 | Tampering | the earlier-record lib writing outside the sandbox | low | mitigate | `features/lib/mcp-builtin-earlier-record.ts:70-72,105-118` writes only `<scopeRoot>/pi-claude-marketplace/state.json`; the step passes `this.scopeRoot(scope)` (`features/step_definitions/mcp-server/implementation-switch.steps.ts:35-40`) and re-reads the record | closed |
| T-02-31 | Information disclosure | a user who believes resolved secrets stay private to the server | medium | mitigate | `docs/mcp-compatibility.md:189` and `:606` state that Pi gives every registered config, resolved secrets included, to every extension in the process (P2-DC-02) | closed |
| T-02-32 | Elevation of privilege | a legacy `mcp.json` entry resolved with Pi's `$` and `!` rules in the first built-in session after an upgrade | medium | mitigate | `docs/mcp-compatibility.md:213-215,470,598` state the one-session gap, its cause, and Pi's `$` and `!` rules; AMIG-01 move is wired into the same load (`orchestrators/reconcile/load.ts:89,135,175`, `mcp-migration.ts`); re-verification is parent line 9 (02-08-SUMMARY:177). Residual gap is accepted risk AR-02-11 (P2-DC-11) | closed |
| T-02-33 | Tampering | a Wave 2 merge that breaks another plan's expectation | high | mitigate | Phase gate on the combined tree `02-08-SUMMARY.md:95-116`: `check:static`, `test:unpaired`, `test:integration`, `test:coverage:direct:all`, `test:modules` all exit 0; builtin profile 96 of 97 (one failure, `companion-missing.feature:61`, a Phase 3 cell, cause proved and tolerated per P2-DC-43, parent line 6); adapter profile 1564 of 1564. Auditor re-ran the phase's 10 unit and conformance files on HEAD: 249 pass | closed |
| T-02-34 | Repudiation | a change outside the phase's files applied without a record | low | mitigate | `git diff --name-only 87d3f28..HEAD` outside `.planning/` lists only phase-owned files plus `test/orchestrators/plugin/info.test.ts`, recorded as parent line 7 and P2-DC-31. No frozen product file changed (`index.ts`, `platform/pi-api.ts`, `persistence/state-io.ts`, `domain/mcp-implementation.ts`, `orchestrators/mcp/recorded-servers.ts`, `orchestrators/mcp/session-materialize.ts`). Parent lines 1-20 in 02-08-SUMMARY | closed |
| T-02-35 | Spoofing | a server another extension registered first under a plugin server's name reads as the plugin's in info | low | accept | P2-DC-46: the reader cannot learn this extension's own `extensionPath` through its frozen parameter; stated in `platform/mcp-builtin-status.ts:35-39`, `docs/mcp-compatibility.md:203-205,602`, COVERAGE.md, and BACKLOG parent line 4(e). Accepted risk AR-02-06 | closed |
| T-02-36 | Spoofing | two server names that fold to one tool namespace (`my-db` and `my_db`) | low | mitigate | ANAME-03 at install: `bridges/mcp/stage.ts:350-375` (`keyedServers` throws `McpServerKeyCollisionError` on a folded clash), tests `test/bridges/mcp/stage.test.ts:2634-2675`; Pi refuses a registration clash and the sync logs it (`builtin-registration.ts:76-78`); hyphen scenario `listing.feature:186-203` | closed |
| T-02-37 | Denial of service | two long names whose cut tool names collide | low | accept | Pi's 64-character cut is Pi's (D-MB-13, a Pi capability gap recorded in `docs/mcp-compatibility.md:116,597`); scenario `listing.feature:205-222` pins Pi's names. Accepted risk AR-02-09 | closed |
| T-02-SC (02-01..02-09, 9 rows) | Tampering | npm installs | low | accept | No plan adds a package: `git diff 87d3f28..HEAD` touches no `package.json`, `package-lock.json`, or workflow file; installers keep the committed lock and the Phase 1-audited peer floors (T-01-SC). Accepted risk AR-02-10 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Totals.** 46 rows: 28 mitigate, 18 accept (9 threats and 9 `T-02-SC`), 0 transfer. Severity of the 37 named threats: 16 high, 10 medium, 11 low; the 9 `T-02-SC` rows are low. All 46 are closed, none open.

**Advisory notes (auditor, not threats, none counted in `threats_open`).**

- **UF-2 (low).** The containment check bounds a `path`-kind marketplace by `marketplace.marketplaceRoot`, which comes from the same `state.json` as the record (`builtin-registration-step.ts:175`). A hand-edited state that sets that root to `/` passes every record of that marketplace. The root is the user's own directory and cannot be bounded further; it is recorded in P2-DC-13 as amended by P2-DC-94 and P2-DC-95. Cloned marketplaces are bounded by their checkout (`:169-173`). The same file already holds the `mcpServerConfigs` that become the server commands, so this adds no new privilege.
- **UF-3 (low).** The description read passes the marketplace record's `manifestPath` to the shared `loadMarketplaceManifest` without a containment check (`bridges/mcp/builtin-description.ts:67`). Only a `description` string reaches Pi. The plugin manifest candidates are contained (`:106-117`).
- **UF-4 (info).** The frozen legacy reader logs `recorded MCP servers unreadable: <message>` without redaction (`orchestrators/mcp/recorded-servers.ts:64`). The channel is opt-in, and no config value reaches it. Recorded in 02-REVIEW-FIX (IN-01 residual).
- **UF-5 (info).** Phase 1 accepted risk T-01-22 depended on Phase 2 scenarios not using the built-in stand-in. P2-DC-81 shows the stand-in loads idle in twins with no launch variable, and the seed red runs failed at the listing wait (02-01-SUMMARY, 02-08-SUMMARY:139), so it does not hide a missing registration. The acceptance still holds.
- **Behavior not proven end to end (not a threat).** Built-in `/reload` and in-session new-session re-registration have no scenario (P2-DC-77, P2-DC-88). The verifier carries both as `02-UAT.md` items (accepted provisionally, P2-DC-100).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-03 | P2-DC-02: resolved values, credentials included, sit in Pi's session registry and any extension in the same Pi process can read them through `getMcpServers()`; that process already holds them in `process.env`, and nothing is persisted. Stated in the docs. DUBIOUS-CHOICES severity is High and status open, so the user can reverse it | plan 02-01 register, autonomous run; user review pending | 2026-11-04 |
| AR-02-02 | T-02-11 | The launch variable holds test-only values inside the run's sandbox | plan 02-02 register, autonomous run | 2026-11-04 |
| AR-02-03 | T-02-12 | The http stand-in listens on `127.0.0.1` only and the scenario release closes it | plan 02-02 register, autonomous run | 2026-11-04 |
| AR-02-04 | T-02-15 | The config probe is a harness extension that only `@builtin-only` scenarios load; the values are fixtures | plan 02-03 register, autonomous run | 2026-11-04 |
| AR-02-05 | T-02-20 | Info shows only this extension's own server names and a fixed token, never mcp.json contents | plan 02-04 register, autonomous run | 2026-11-04 |
| AR-02-06 | T-02-35 | P2-DC-46: when another extension registered `plugin_<plugin>_<server>` first, Pi refuses this extension's registration (debug log only) and info shows the other server's state. The reader cannot learn its own `extensionPath` through its frozen parameter, and the other extension already runs in the same Pi process. Documented, with a BACKLOG parent line for the fix. DUBIOUS-CHOICES severity is Medium, status open | plan 02-04 register (checker revision), autonomous run; user review pending | 2026-11-04 |
| AR-02-07 | T-02-23 | The echoed plugin root and data paths are sandbox fixture paths projected to run tokens | plan 02-05 register, autonomous run | 2026-11-04 |
| AR-02-08 | T-02-26 | Autoapply is the user's setting (AAP-01, default off); its load report names each install | plan 02-06 register, autonomous run | 2026-11-04 |
| AR-02-09 | T-02-37 | Pi's name cut is Pi's (D-MB-13, a Pi capability gap); the scenario pins Pi's names | plan 02-09 register, autonomous run | 2026-11-04 |
| AR-02-10 | T-02-SC (02-01..02-09) | No package is added by any plan; the diff touches no dependency file | plan registers, autonomous run | 2026-11-04 |
| AR-02-11 | T-02-32 (residual) | P2-DC-11: in the first built-in session after an upgrade from a release before AMIG-01, Pi runs each legacy `mcp.json` entry once more under its old name, with Pi's `$` and `!` rules. Pi reads `mcp.json` at its own `session_start`, before an extension can move the entry; the same load's AMIG-01 move removes it. Stated in the docs. DUBIOUS-CHOICES severity is Medium, status open | plan 02-08 register, autonomous run; user review pending | 2026-11-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-04 | 46 | 46 | 0 | gsd-security-auditor (ASVS 1, block on high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-04 (autonomous run; user review pending)
