# Quick Task 260810-b7w — Source Material

Verified research findings for `docs/competitive-analysis/pi-plugins.md`. Every claim below was
checked against the competitor source tree or our own. Items explicitly marked UNVERIFIED must be
carried into the final document with that qualification or omitted -- never asserted as fact.

**Competitor snapshot:** `nklisch/pi-extensions`, commit `175142c7f6029f8676e5d9fcea3037520ff90b86`,
package `@nklisch/pi-plugins` v0.3.5, MIT, author Nathan Klisch. Paths below are relative to
`packages/pi-plugins/`.

**Our side:** `pi-claude-marketplace` v0.13.0, MIT. Paths relative to repo root.

---

## 1. Headline metrics

| Metric | Them | Us |
| --- | --- | --- |
| Source size | 79,579 LOC / 417 `.ts` files | 57,552 LOC / 202 `.ts` files |
| Tests | 1,558 `it()`/`test()` sites, 365 files, Vitest 4 | 3,254 tests, 223 files, `node:test` |
| Node floor | `>=24` (hard: uses `node:sqlite`) | `>=20.19.0` |
| Distribution | Compiled to `dist/` via `tsc` | No build step; Node strips TS natively |
| Pi API | peer `*`, dev-pinned `0.82.0`; internal ranges `>=0.80.0 <1.0.0-0` | peer `>=0.80.5`, dev `^0.83.0`, floor enforced by a test |
| Runtime deps | 7, incl. bundled forks of MCP adapter + subagents | 3 (`isomorphic-git`, `proper-lockfile`, `write-file-atomic`) |
| Git transport | Spawns the `git` binary (`options.gitExecutable ?? "git"`) | `isomorphic-git`, pure JS, no binary needed |
| Boundary gates | ~25 `dependency-cruiser` rules in `npm test` | architecture tests (grep gates) in the suite |
| Release span | v0.1.0 -> v0.3.5, 2026-07-24 to 2026-08-08 | ongoing since earlier |

Their two runtime siblings are maintained MIT forks the author publishes himself:
`@nklisch/pi-subagents` (forks `@gotgenes/pi-subagents@18.0.3`) and `@nklisch/pi-mcp-adapter`
(forks `nicobailon/pi-mcp-adapter@2.11.0`), both forked because upstream lacked a programmatic
contract. We soft-depend on the upstream packages instead and degrade presentationally when absent.

---

## 2. Scope and philosophy

Their `docs/VISION.md` fixes the shared supported surface at exactly three component kinds:
Agent Skills, command lifecycle hooks, MCP servers. Everything else is "retained metadata."
Stated principles include whole-plugin lifecycle (components are never independently selected),
honest compatibility (approximation is never presented as equivalence), atomic change, and
explicit trust.

`docs/COMPATIBILITY.md` "Explicit non-goals" lists: foreign model-provider behavior, foreign
permission systems, enterprise policy, hosted Codex apps, **Claude agents and agent teams**, LSP,
themes and output styles, background monitors, bidirectional foreign-state sync, and
**partial plugin installation**.

Ours is the opposite trade: five component kinds, partial installs, soft-dependency degradation,
and offline-first guarantees enforced structurally.

---

## 3. Component kind matrix

| Claude component | Them | Us |
| --- | --- | --- |
| Skills | Supported -> `resources_discover` returning `skillPaths` into their content-addressed store | Supported -> `<extensionRoot>/resources/skills/<gen>/` (whole dir copy) |
| Commands (slash) | **Not supported.** No `commands/` convention scan exists anywhere in `src/`; a declared `commands` field is inert metadata (`src/domain/foreign-identity.ts:11`) | Supported -> Pi prompt template at `resources/prompts/<plugin>:<command>.md` |
| Agents | **Not supported.** Foreign/non-goal | Supported -> `<scopeRoot>/agents/pi-claude-marketplace-<plugin>-<agent>.md` + `agents-index.json`, with a 7-entry tool map, `Skill` -> `inheritSkills: true`, and `--map-model` |
| MCP servers | Supported -> programmatic registration into their forked adapter with `fileDiscovery: "disabled"`; no `.mcp.json` written | Supported -> merged into `<scopeRoot>/mcp.json`, names verbatim, collisions refuse rather than rename |
| Hooks | Supported (`type: "command"` only) | Supported -> staged `hooks/<plugin>/hooks.json` + in-memory routing |
| lspServers, monitors, themes, outputStyles, settings, channels, userConfig | Retained metadata; `userConfig` is a special case (see §5) | Surfaced as unsupported -> `partially-available`; installable via `--partial` |

Their `docs/` claims Claude flat command markdown is representable as a Pi skill; no distinct code
path implements this beyond the ordinary root-`SKILL.md` fallback. Treat as a doc claim without
verified implementation.

**Their MCP honesty note:** they refuse to fabricate Claude-style `mcp__plugin_x_y__tool` aliases,
reporting `RUNTIME_ALIAS_UNAVAILABLE` instead. Whether we synthesize such aliases is UNVERIFIED.

---

## 4. Source kind matrix

Theirs (`src/domain/source.ts:176-265`, two disjoint strict zod unions):

- Marketplace sources (3): `github` (default, `owner/repo`), `git` (HTTPS / `ssh://` / SCP form),
  `local-git`.
- Plugin sources (4): `marketplace-path` (`./relative`), `git`, `git-subdir`, `npm`.
- No standalone archive/tarball/url/local-path plugin source; tar and HTTP are acquisition
  mechanisms only. Raw remote `marketplace.json` URLs rejected as a marketplace source.
- npm acquisition is pure HTTPS: packument GET -> zod parse -> version select (exact/tag/semver
  range) -> tarball GET -> SHA-512 verify (hash-on-write and rehash-from-disk, `timingSafeEqual`)
  -> gunzip + TAR extract. **Never runs `npm install`, never runs lifecycle scripts.**
- No persistent clone cache; every install/update re-fetches into fresh scratch under the staging
  slot's `.work/`. Content is cached content-addressed under `stores/{marketplaces,plugins}/v1/`.
- Git submodules fail materialization outright. Unqualified branch/tag collisions rejected as
  ambiguous even when both currently peel to the same commit.
- Project-scope marketplace registration is allowed for portable sources only (github/git);
  `local-git` at project scope is rejected `NOT_PORTABLE`.

Ours (`extensions/pi-claude-marketplace/domain/source.ts`): `path`, `github`, `url`, `git-subdir`
supported; `npm` parsed and listed but resolver returns `unsupported source kind: npm`; `unknown`
forward-compat arm. Rejected by design: `http://`, `ssh://`, `git@host:` scp-form, `~user/...`,
browser `/tree/<ref>` URLs. A `sha` must be full 40-hex or it is silently dropped (degrades to
unpinned rather than mis-keying the cache). Source-addressed clone cache at
`plugin-clones/<key>/`; GC derives live keys from surviving `resolvedSha` records.

---

## 5. Plugin user configuration (they have, we do not)

`src/formats/claude/user-config-reader.ts` reads Claude `userConfig` descriptors. Recognized
descriptor fields: `type, title, label, description, required, sensitive, default, min, max,
minItems, maxItems, pattern, multiple, mustExist`. Value types: string, number, boolean, directory,
file, and string arrays where `multiple` is declared. Required fields, defaults, numeric bounds and
path validation are enforced. Prototype-pollution keys (`__proto__`, `prototype`, `constructor`)
are rejected.

Configured values reach components as `${user_config.KEY}` and `CLAUDE_PLUGIN_OPTION_<KEY>`.
They classify this as compatibility infrastructure, not a separate component kind.

**Sensitive values are fail-closed on every platform.**
`src/infrastructure/secrets/create-platform-secret-store.ts:20-37` unconditionally returns
`createUnavailableSecretStore()`. There is no macOS Keychain, no libsecret/`secret-tool`, and no
Windows Credential Manager code anywhere in the tree. Any plugin requiring a sensitive value cannot
activate; diagnostic `SECRET_CUSTODY_UNAVAILABLE`. Stated rationale: Secret Service's
`CreateItem(replace=false)` cannot prove atomic no-replace ownership.

We treat `userConfig` as an unsupported component kind, which downgrades any declaring plugin to
`partially-available`.

---

## 6. Trust model (they have, we do not)

Trust subject = `sha256("trust-subject-v1\0" + injective-encode({plugin, scope, marketplaceSource,
pluginSource, immutableRevision, executableSurfaceDigest}))`.

- `immutableRevision`: Merkle-ish SHA-256 root digest over every file, directory and symlink in the
  installed bundle.
- `executableSurfaceDigest`: separate SHA-256 over a curated normalized projection (skill id/name/
  root, hook id/event/matcher/handler, MCP id/key/declaration, config option shape).
- Any byte change to the tree, or any change to the executable surface, yields a different subject,
  so the prior grant no longer matches and hooks + MCP stop until re-trusted.
- SHA-256 throughout; no other algorithm.

**Trust continuity** (`automatic-trust-continuity.ts`) is what makes exact-content trust survive
updates. A new revision's subject is auto-granted only when all four hold: effective policy is
`automatic` with `sourceGuard: "none"`; no exact record exists yet; a *granted baseline* exists for
another revision of the same plugin with matching source identities; and the exact subject is not
revoked. Continuity grants are ordinary individually-revocable records; explicit revocation always
wins; no granted lineage means interactive consent is still required.

**Two gaps in their own implementation:** `revokeTrust` exists in the domain and is exported, but no
application service or command invokes it -- there is no `/plugins untrust` verb in the registry.
And trust review always discloses `remote MCP discovery: "not-performed"` -- remote MCP servers are
never live-probed at consent time.

**"Receipts" are shape gates, not content hashes.** `src/runtime/published-package-receipt.ts`
verifies sibling packages' name/version/license/engines/peerDeps/exports/`pi.extensions` against a
hard-coded receipt before `jiti`-importing them. Its own doc comment says byte integrity is npm's
job and the load-time gate verifies SHAPE. The `sha512-` constants in source are descriptive
metadata, not re-verified at load.

**Neither project sandboxes execution.** Once trusted, their hook commands run as ordinary child
processes with full OS privileges; `hook-executable-resolver.ts` resolves whatever command string
the plugin declares with no allowlist. Their "guarded" execution is resource bounds only: 8
concurrent, 256 KB stdin, 64 KB stdout/stderr, 10 s default / 600 s max timeout, SIGTERM ->
SIGKILL process-group teardown. Their containment is supply-chain/consent-layer; ours is
write-target-layer (path containment, atomic writes). Neither is execution-layer.

Our position: plugin code is trusted on install. No signatures, no checksums against a trusted
digest, no allowlist. `resolvedSha` is a reinstall pin and GC liveness key, not a verified value.
Hook commands spawn with `shell: true` when `args` is absent; each enabled plugin's `bin/` is
appended (never prepended, CWE-426) to `PATH`; MCP stdio servers launch with plugin-declared `env`
overriding injected defaults.

---

## 7. Network hardening (theirs)

- **DNS pinning** (`src/infrastructure/network/network-egress-policy.ts`, `http/bounded-fetch.ts`):
  resolve once with `dns.lookup({all:true})`, classify every address, reject forbidden and
  unlisted-private, deterministically select one, then force it into the connection --
  `-c http.curloptResolve=host:port:addr` for git-HTTPS, `-o HostName=<addr> -o HostKeyAlias=<host>`
  for git-SSH, and a custom Node `lookup` preserving TLS SNI `servername` for HTTP. Re-authorized on
  every redirect hop. Ambient proxy env vars stripped because they would bypass pinning.
- **Origin authorization**: exact-string allowlists from `PI_PLUGIN_HOST_PRIVATE_ORIGINS`,
  `PI_PLUGIN_HOST_CREDENTIAL_ORIGINS`, `PI_PLUGIN_HOST_REDIRECT_ORIGINS`. Credentials attach only to
  origins in `credentialOrigins`.
- **MCP endpoint security**: `"tls" | "consent-bound-loopback-plaintext"`. Plaintext HTTP allowed
  only for a literal loopback IP (`127.0.0.0/8`, `::1` -- not the name `localhost`), no template
  tokens, no sensitive query names, and rejected outright if any header or bearer token is present.
- **Hardened TAR reader** (`src/infrastructure/archive/tar-reader.ts`): rejects `..`, absolute/UNC/
  backslash, NUL, control chars, Windows device names, trailing dot/space, any `.git` segment;
  resolves symlink targets against the virtual root; rejects PAX/GNU path-indirection metadata
  (`x/X/L/K`) rather than honoring it; rejects special file types, setuid/setgid, sparse forms;
  detects case/Unicode-normalization collisions; `O_EXCL|O_NOFOLLOW` creation; post-write realpath
  containment sweep; decompression-bomb guards (default 100x ratio).
- **Redaction**, four layers: shared sensitive-field-name regex (`src/domain/sensitive-fields.ts`);
  text/command/env redaction (URL userinfo, Bearer/Basic, sensitive query params); a `SensitiveValue`
  wrapper whose `toString`/`toJSON`/`util.inspect.custom` all return `[REDACTED]`; and a control-output
  projection that hard-omits `cause/stack/message/plaintext/headers/environmentValues`, throws if a
  raw `SensitiveValue` reaches output, and strips C0/C1 and Unicode bidi-override scalars.

Ours: `redactAbsolutePaths` collapses absolute paths to basenames; `causeChainTrailer` surfaces only
`Error.message`, never `.stack`, bounded at depth 5 with cycle detection. `platform/git-credential.ts`
spawns `git credential fill/approve/reject` with `GIT_TERMINAL_PROMPT=0` / `GCM_INTERACTIVE=never`,
checks attribute values for `[\r\n\0]` injection, and never emits `path=`. `domain/github-auth.ts`
implements RFC-8628 device flow; tokens are never written to any file we own -- they go to the OS
keychain via git's helper chain. Only `github.com` is registered; `auth-host.ts` returns `undefined`
for unclaimed hosts to prevent cross-host credential leakage.

---

## 8. Command surface

**Theirs** -- one command `/plugins`, versioned grammar `plugin-control/v1`, registry at
`src/application/native-control-registry.ts`, mechanically verified against `docs/SPEC.md` by
`test/documentation/native-control-spec.test.ts`.

Global controls (precede the command path): `--grammar-version`, `--output human|json`,
`--timeout-ms <1..86400000>`, `--non-interactive`, and exactly one of `--input-stdin` /
`--input-file <path>` / `--input-env-prefix <PREFIX>`.

Primary verbs: `add` (aliases `install`, `install run`), `remove` (alias `uninstall`), `update`,
`enable`, `disable`, `trust`, `list`, `show` (alias `inspect`), `doctor` (alias `diagnose`),
`status`, `browse`, `help`, `grammar`, `marketplace add|remove|list|refresh (alias update)`,
`marketplace adopt preview|import` (aliases `adopt preview|import`), `project sync` (alias
`project-sync`), `updates status`, `updates policy preview|apply|set`,
`updates notices list|acknowledge (alias ack)`, `updates automatic run`,
`config host-precedence`, `config hook-visibility`.

Protocol-visibility (hidden from help/completion): `install open|apply|recover` (three-phase
token-based install) and `operation status|cancel` (poll/cancel by opaque token).

Notable flags: `--preview-only` on enable/disable/update/remove/project sync (per-operation dry
run); `--keep-data` / `--delete-data` on remove, exactly one required (`CONTROL_RETENTION_REQUIRED`
if neither, `CONTROL_OPTION_CONFLICT` if both); `--yes` required on `marketplace remove`, `adopt
import`, `trust`; `--scope user|project`; `--snapshot-id`/`--detail-id` all-or-nothing pairs;
`--cursor`/`--limit` pagination (marketplace list 1..200 default 50; browse/list 1..100 default 50;
notices 1..200 default 50; automatic run 1..100 default 20); `--condition
ready|attention|blocked|unavailable` on list; `--source-kind github|git|local-git` and `--ref` on
marketplace add.

Aliases are exact alternate paths, never fuzzy, and carry `deprecatedSince` / `replacement` /
`removeInMajor` metadata.

Exit codes (`src/application/native-control-contract.ts:19-31`): `0` success, `2` usage, `3`
input-required, `4` not-found, `5` conflict-or-stale, `6` unavailable, `7` rejected-or-blocked, `8`
partial-or-recovery-required, `9` cancelled-or-timeout, `10` internal, `74` output-delivery-failed.

Output channel is mode-keyed (`src/pi/pi-control-channel.ts`): `rpc`/`json` -> `pi.appendEntry`
frames; `print` -> stdout lines; `tui` -> no-op (the manager consumes frames directly). Progress
framing is a zod discriminated union `accepted|progress|result` with strict ordering.

**Ours** -- one command `/claude:plugin`, router at `edge/router.ts`, flag catalog at
`edge/flag-catalog.ts`, drift-guarded by `tests/architecture/flag-catalog-drift.test.ts`.
`--scope user|project` is global and position-independent.

| Subcommand | Aliases | Flags |
| --- | --- | --- |
| `bootstrap` | -- | none (rejects `--scope`) |
| `install` | -- | `--scope`, `--map-model`, `--partial`, `--local` |
| `uninstall` | -- | `--scope`, `--local` |
| `update` | -- | `--scope`, `--map-model`, `--partial`, `--local` |
| `fetch` | -- | `--scope` |
| `reinstall` | -- | `--scope`, `--local` |
| `list` | `ls` | `--scope`, `--installed`, `--available`, `--unavailable`, `--partial`, `--remote` |
| `info` | -- | `--scope`, `--fetch` |
| `pending` | -- | `--scope` |
| `enable` / `disable` | -- | `--scope`, `--local` |
| `import` | -- | `--scope` |
| `marketplace add` | -- | `--scope`, `--local` |
| `marketplace remove` | `rm` | `--scope`, `--local` |
| `marketplace list` | `ls` | `--scope` |
| `marketplace info` | -- | `--scope` |
| `marketplace update` | -- | `--scope` |
| `marketplace autoupdate` / `noautoupdate` | -- | `--scope`, `--local` |

`fetch` is a pi-only verb with no upstream `/plugin` equivalent. We have no machine-readable output
mode, no exit-code vocabulary, no pagination, and no operation tokens.

---

## 9. Interactive manager (theirs; we have none)

Built on `@earendil-works/pi-tui` primitives plus Pi's `Theme`/`KeybindingsManager`, mounted via
`context.ui.custom()`. Nested surfaces (confirm, text input, masked input, install flow) mount
inline via a hand-rolled `presentInline<T>()` slot because Pi's custom-UI container cannot stack.

Their README and ARCHITECTURE describe five sections (My Plugins / Discover / Sources / Updates /
Health); the implementation (`src/pi/manager/plugin-manager-model.ts:8-10`) has **two views** --
`installed` ("Plugins") and `marketplaces` ("Marketplaces") -- with a four-way filter lens
`all | installed | available | updates`. Health is a status clause in the heading; Updates is a
filter. The docs are stale relative to the code.

Keybindings: arrows navigate; left/right cycle the filter lens; PgUp/PgDn page with auto-load of the
next page; Enter opens detail or runs the focused action; Esc cancels op, then dismisses result,
then goes back one level, then closes; `/` focuses search; `m` toggles views; `a` add/install; `d`
disable/enable; `x` remove; `u` update; `Ctrl+U` update-all; `p` update policy; `r` refresh; `?`
help. Confirmations use `y`/`n` plus Space to expand the exact disclosure.

Actions are derived live from authoritative inspection detail, never shown unconditionally. Install
is a three-step flow (review -> configure + trust -> activation result). Destructive/consent actions
require fresh confirmation each run. Sensitive config always routes through a `MaskedInputSurface`
backed by `SensitiveValue` with no plaintext getter. The manager opens only when
`context.mode === "tui"`.

We import `@earendil-works/pi-tui` for the `AutocompleteItem` type only (3 sites) -- no selectors,
no prompts, no dialogs. We do have a tab-completion provider (`edge/completions/provider.ts`) with
5 branches: top-level keywords, `--scope` values, per-verb flag names, nested marketplace
subcommands, and status-aware `<plugin>@<marketplace>` refs. Returns `null` (not `[]`) when no
completion applies, per the pi-tui contract. The exact contents of their completion provider are
UNVERIFIED.

---

## 10. State, storage, concurrency

**Theirs:** SQLite via Node 24's built-in `node:sqlite` -- no native module, no JSON state files.
Five DB families under `<agentDir>/plugin-host/`: `state/v1/user.sqlite` and
`state/v1/project-<sha256>.sqlite` (`journal_mode=DELETE, synchronous=FULL, busy_timeout=0`);
`locks/v1/*.sqlite`; `recovery/journal/v1/*.sqlite`; `recovery/leases/v1/leases.sqlite`;
`recovery/retention/v1/retention.sqlite`. Content lives on the filesystem content-addressed under
`staging/v1/`, `stores/v1/`, `data/v1/`, `generated/v1/`.

Six independently-versioned schema families (hostConfig=4, installedUser=2, trust=1, projectLocal=4,
portableProject=1, pointers=1). **State documents are never migrated** -- an unknown/stale version
raises `StateVersionCutoverError` and reinitializes the scope to generation-0 defaults, explicitly
"never reported as corruption." Only the recovery journal does real `ALTER TABLE` migration.

The cross-process lock **is a held SQLite `BEGIN IMMEDIATE` transaction** on a per-scope lock DB --
no lockfiles, no flock. A killed holder is released by the OS. Retry on SQLITE_BUSY with jittered
backoff (5-100 ms), zero native busy timeout, cancellable via AbortSignal. No lock expiry, no PID
takeover, no heartbeat, no fairness. Nested inside it is an in-process keyed mutation scheduler
(FIFO, keyed `scope:plugin`, sorted multi-key acquisition, `RecursiveMutationAcquisitionError`
guard via `AsyncLocalStorage`).

Revision leases are GC pins, not locks -- recorded with `(pid, start-token)` so content a possibly
live session is reading is never collected.

Atomicity: state commits are generation compare-and-swap (`expectedGeneration` -> `+1`), written and
re-verified in one transaction, with an independent post-hoc `provesMutationResult` check that
rejects any commit result the coordinator cannot re-derive. Content promotion is stage -> fsync ->
seal read-only (555/444) -> write `READY.tmp` -> rename -> **publish visibility via `link(2)`**
(atomic, fails `EEXIST` instead of clobbering, chosen because Node lacks `renameat2(RENAME_NOREPLACE)`
for directories) -> fsync store dir.

Scopes: exactly two, `user` and `project` -- same as ours. "Global" is a placement inside the
user-scope `hostConfig` document, not a third scope. Project identity is `repository` (canonical root
+ inode-based Git fingerprint, deliberately v2 after `st_dev` broke on btrfs) or a `path-only`
fallback literally tagged `limitation: "identity-changes-with-canonical-root"`.

Crash recovery (`src/application/recovery-service.ts`) is bounded per run (2 s budget, 128
transitions, 24 h abandon grace). It classifies pending transitions using PID **plus OS start-time
token** (procfs on Linux, native queries on macOS/BSD/Windows) so recycled PIDs cannot be mistaken
for live owners; live/unknown owners are always deferred, never touched; dead owners get
finalize-or-compensate; ambiguous cases persist as `recovery-required`. Startup order is
load-bearing: runtime reconstruction runs before the recovery sweep so a crash after successful
activation finalizes as completed rather than rolling back.

**Portable project declaration:** `<projectRoot>/.pi/plugins.json` is the committed, portable half
-- schema version, marketplace sources restricted to github/git, requested plugin identities,
constraints, enabled intent; explicitly no absolute paths, caches, timestamps, credentials, or
trust. Written temp + fsync + hard-link (never overwrite, to avoid clobbering an editor save). The
machine-local half is the `projectLocal` SQLite document carrying a `declarationDigest` pinning the
last portable declaration that machine reconciled against (sentinel
`portable-project-intent-unsynchronized-v1` when fresh). `project sync --mode
apply-intent|publish-intent|merge` reconciles the two.

**Ours:** scope roots are `$PI_CODING_AGENT_DIR` or `~/.pi/agent` (user) and `<cwd>/.pi` (project);
`extensionRoot = <scopeRoot>/pi-claude-marketplace`, branded and frozen in
`persistence/locations.ts`. Files: `state.json` (authoritative), `.state-lock`,
`claude-plugins.json` / `.local.json` (declarative desired state), `<scopeRoot>/agents/`,
`<scopeRoot>/mcp.json`, `agents-index.json`, `resources/{skills,prompts}/`, `*-staging/`,
`sources/<mp>/`, `plugin-clones/<key>/`, `hooks/<plugin>/hooks.json`, `data/<mp>/<plugin>/`,
`cache/` (optimization-only, deletable).

`state.json` accepts `schemaVersion: 1 | 2` and always writes 2, with real migrations.
`claude-plugins.json` pins `schemaVersion: 1` as a literal -- future versions go to a successor
file, never a bump. `loadConfig` never throws; it returns `absent | invalid | valid`, and a 0-byte
file lands in `invalid` because coercing it to empty desired state would render as a mass-uninstall
plan. `.local.json` overrides at entry level, wholesale (anti-deepmerge). `config-write-back.ts` is
structurally forbidden from importing the merge module so a merged view can never be serialized back
over the base file.

Locking: `proper-lockfile` on `<extensionRoot>` with `lockfilePath: .state-lock`, `retries: 0`
(fail-fast -> `StateLockHeldError`), `stale: 10_000`, `update: 2_000`. Not re-entrant; guard-free
ledger bodies exist so callers already holding the lock can reuse them.

Ledger: `runPhases<C>` generic; install is 6 phases (skills, commands, agents, hooks, mcp, state).
The failing phase's own `undo` runs first, then the reverse walk. Failures surface as
`RollbackPartial[]` carrying the original `Error`. Recovery is `applyReconcile` on
`resources_discover`, diffing desired vs actual into 7 buckets applied as uninstall -> remove -> add
-> install -> enable -> disable, with four layers of per-scope/per-plugin failure isolation. A
pristine scope creates nothing. `/reload` alone suffices for every recovery (NFR-2).

---

## 11. Update model

**Theirs:** a background coordinator starts unawaited at host start and runs a lease-based
single-owner-per-scope loop polling scope inventory every 30 s. Per-marketplace cadence is
`paused (0) | conservative (24h +/-2h) | balanced (6h +/-30m) | frequent (1h +/-5m)`, each with
exponential failure backoff and deterministic SHA-256-derived jitter. Comparison is immutable
revision / content digest, not semver (semver only resolves npm ranges).

Policy precedence: plugin override > marketplace override > scope/project > global. Hard guards
force `manual` regardless: `local-git` source, `legacy-unavailable` identity, marketplace-source
drift, plugin-source drift. Automatic is disabled by default for third-party sources.

Denial codes: `POLICY_MANUAL, LOCAL_SOURCE, MARKETPLACE_SOURCE_CHANGED, PLUGIN_SOURCE_CHANGED,
LEGACY_SOURCE_IDENTITY, BASELINE_TRUST_ABSENT, BASELINE_TRUST_REVOKED, PROJECT_UNTRUSTED,
STATE_STALE`. Eligibility reasons: `eligible, manual, approval-required, stale, project-untrusted,
recovery-required, configuration-required, secret-unavailable, capability-unavailable, retryable`.

Notifications: one `UpdateNotice` per discovered revision carrying plugin identity, installed vs
available version/revision, and automatic-or-manual disposition, with unread tracking, bounded
retention (64 resolved/plugin, 4096/scope, 100/dispatch), and auto-resolution
(`installed`/`superseded`/`plugin-removed`). **Notification is independent of automatic-update
settings.**

**Staged updates:** automatic and update-all commit the new revision in the background with the
transition deliberately left pending, activating on next start/reload -- so update runs never need a
reload-capable command context and one pass can stage every eligible plugin. The user sees "update
staged -- live next start", or "recovery required" if the startup sweep could not settle it.
Foreground single-plugin updates activate immediately.

Pinning is a property of the source declaration: a full 40-hex `sha` is authoritative over `ref` and
becomes the resolved trust identity. There is no dedicated pin subsystem.

Rollback is automatic on activation failure only. Prior revisions are retained (`revisions[]` +
`selectedRevision`) with a 24 h unreferenced grace before mark/sweep GC. `restoreAndVerify()` writes
back the previous revision, re-reloads, and re-verifies that the rollback itself activated; failure
degrades to `recovery-required`. **There is no manual rollback/revert command** -- the only levers
are `update` with an explicit candidate id, or editing the source `ref`/`sha`.

**Ours:**

| Verb | Network | Behavior |
| --- | --- | --- |
| `install` | on cache miss only | cached manifest, no sync |
| `update` | yes | re-resolves the pin, refreshes the mirror, short-circuits when `toVersion === fromVersion` |
| `fetch` | yes (that is the op) | writes no state; pinned + materialized -> `(skipped) {up-to-date}` with no network |
| `reinstall` | almost never | never resolves a pin; repairs fs-only from the warm mirror using the recorded sha |
| `uninstall` / `enable` / `disable` | never (gate-enforced) | disable zeroes resources but keeps the record; enable replays the ledger with `pinVersionOverride` so a cycle cannot bump the version |

Versions: `hash-<12hex>` (SHA-256 over a deterministic walk, symlinks skipped, BOM/CRLF-normalized)
or `sha-<12hex>` for git sources. Ladder: `pinVersionOverride` > git `resolvedSha` >
`plugin.json.version` > manifest entry version > content hash.

Autoupdate is opt-in, default off, stored in `claude-plugins.json` (not state). **There is no timer,
no interval, and no session-start update run** -- the flag is consumed solely by `marketplace
update`. Change detection when autoupdate is off is a conservative manifest content compare
(`JSON.stringify` pre/post).

Offline guarantee: `install.ts`, `list.ts`, `reinstall.ts`, `info.ts`, `fetch.ts`,
`enable-disable.ts`, `marketplace/info.ts` and all three reconcile files are grep-gated by
`tests/architecture/no-orchestrator-network.test.ts` against `platform/git`, `DEFAULT_GIT_OPS`,
`gitOps`, `refreshGitHubClone`. Only `update.ts` is exempt. Git access flows through the
`clone-cache.ts` seam by entrypoint name.

Our git surface (`platform/git.ts`, the only `isomorphic-git` importer): `clone`, `fetch`,
`checkout`, `resolveRef`, `resolveRemoteRef` (via `listServerRefs`, no clone), `forceUpdateRef`,
`currentBranch`, `listBranches`, `listRemotes`. Not exposed: sparse checkout, shallow/`depth`,
submodules. Marketplace refresh is `fetch -> forceUpdateRef -> checkout`, never `pull`.

---

## 12. Hooks

**Their event mapping** (`src/domain/hook-runtime-contract.ts:20-51`): `SessionStart` ->
`session_start` + `session_compact`; `SessionEnd` -> `session_shutdown`; `UserPromptSubmit` ->
`input`; `PreToolUse` -> `tool_call`; `PostToolUse`/`PostToolUseFailure` -> `tool_result`;
`PreCompact` -> `session_before_compact`; `PostCompact` -> `session_compact`; `Stop` ->
`agent_settled`; `SubagentStart`/`SubagentStop` -> subagent interception (capability-gated).
~17 other Claude events retained-not-activated, including `PermissionRequest`, `PermissionDenied`,
`Setup`, `UserPromptExpansion`, `PostToolBatch`, `Notification`, `MessageDisplay`,
`TaskCreated/Completed`, `StopFailure`, `TeammateIdle`, `InstructionsLoaded`, `ConfigChange`,
`CwdChanged`, `FileChanged`, `WorktreeCreate/Remove`, `Elicitation*`.

Their hook features: shell-form and exec-form commands, `timeout`, `statusMessage`,
`shell: bash|powershell`, tool-name aliases (`Bash->bash`, `Read->read`, `Write->write|apply_patch`,
`Edit->edit|apply_patch`, `Glob->find`, `Grep->grep`, `Ls->ls`), regex/exact-set matchers, and `if`
predicates (`equals|contains|matches|regex|in` over
`tool_name|tool_input|tool_response|hook_event_name`). Outputs: exit-2 blocking, `additionalContext`,
`systemMessage`, `decision:block`, `permissionDecision allow/deny/ask`, `updatedInput`,
`updatedToolOutput`, `continue:false`, `stopReason`, session-title update. **`async` and
`asyncRewake` are retained-not-activated.** `permissionDecision:defer`, `terminalSequence`,
`watchPaths` and `CLAUDE_ENV_FILE` mutations are incompatible.

**The subagents point, resolved:** their `src/runtime/subagents/` machinery is not Claude-agent
emulation (Claude `agents/*.md` remains inert metadata). It is lifecycle interception of Pi's *own*
subagents so `SubagentStart`/`SubagentStop` **hook events** can fire before the child prompt and
before final completion, with the ability to inject context, deny a turn, replace a result, or
request bounded same-session continuation. Capability id `pi.subagents.lifecycle-interception`.

**Ours** (canonical matrix in `docs/hooks-compatibility.md`): 10 supported events -- `SessionStart`
-> `session_start` (matcher `source` in {startup, resume}); `UserPromptSubmit` -> `input`;
`PreToolUse` -> `tool_call`; `PostToolUse` -> `tool_result` (`!isError`); `PostToolUseFailure` ->
`tool_result` (`isError`); `PreCompact`/`PostCompact` -> `session_before_compact`/`session_compact`
(match-all only); `SessionEnd` -> `session_shutdown` (match-all only); `Stop` -> `agent_settled`
(`stopReason: stop`); **`StopFailure` -> `agent_settled`** (`error`/`length`, closed 10-value
error-type set). 20 events unsupported, classified deferred / blocked-on-Pi / permanently-inapplicable.

Our `if:` compiler (`bridges/hooks/if-field/`) has 5 arms: `match-all`, `bash`, `path-tool`,
`mcp-literal`, `mcp-server-prefix`. Supported prefixes `Bash(...)`, `Read(...)` (cross-tool: covers
`read/grep/find/ls`), `Edit(...)` (covers `edit/write`), `Write(...)`, `mcp__server__tool`,
`mcp__server[__*]`. Everything else -- `Grep(`, `Glob(`, `LS(`, `MultiEdit(`, parameter matching,
wildcards, malformed syntax, `if` on non-tool events -- falls open to match-all with a debug log,
matching upstream's best-effort contract. The bash parser does quote-aware compound splitting on
`&&`/`||`/`;`/`|`/`|&`/`&`/newline, strips a closed wrapper set (`timeout, time, nice, nohup,
stdbuf, xargs`), recurses into `$(...)`/backticks capped at depth 8, and fires open on
interpolation. Hand-written glob engine, zero deps, **no `RegExp` compiled from user input**.

Note: their `if` is field-based, ours is tool/path-pattern-based. Different designs; neither is a
superset.

Our wire protocol: JSON on stdin capped at 256 KiB UTF-8 (`_truncated: true` assigned last so a
payload key cannot win). Exit 2 -> block with stderr as reason; other non-zero -> noop + debug log;
exit 0 JSON precedence `continue:false` -> stop, `decision:"block"` -> block,
`permissionDecision:"deny"` -> block, else accumulate. Timeout 600 s default, SIGTERM then SIGKILL
+ 5 s, timers `unref`'d, stdout capped 1 MiB, stderr 64 KiB. **No concurrency cap** -- sequential
awaited fan-out, one child at a time (theirs caps at 8 concurrent). Reducer: block/stop terminal,
first-block-wins; mutations whitelisted (`tool_result` accepts only `content` and `isError`, so a
hook cannot rewrite routing fields).

Our `asyncRewake` (`bridges/hooks/async-rewake/`): `asyncRewake: true` spawns detached-in-registry
and returns `noop` immediately. Ring buffers (stderr 64 KiB / stdout 1 MiB) drop the **oldest** bytes
to preserve the tail, since the exit-2 trigger lives at the end. On exit 2 it injects via
`pi.sendMessage({customType:"claude-hook-rewake"})`. A pid table at
`data/_shared/async-rewake-pids.json` survives restarts; orphan reaping does `kill(pid,0)` plus, on
Linux only, a `/proc/<pid>/environ` marker check -- on other platforms alive orphans are soft-skipped
and never killed. `asyncRewake` is inert on `Stop`/`StopFailure` by design. Stop block re-entry
starts a new turn under Pi (upstream folds it into the same turn); loop protection caps consecutive
re-entries at 8 with a one-shot notification; `stop_hook_active` clears only on a genuine `input`
event. Every handler closure captures an epoch and short-circuits after `/reload`.

Only plugin `hooks/hooks.json` is a configuration surface for us -- no `settings.json` hooks, no
`/hooks` command, no `disableAllHooks`.

---

## 13. Diagnostics

**Theirs:** `/plugins doctor [plugin] [--scope] [--include-adoption]`, safety `local-read`. All
findings come from one frozen registry, `NativeDiagnosticRegistry`
(`src/application/native-diagnostic-registry.ts:8-60`), with ~48 stable codes across 12 categories,
each carrying `code, category, severity, rank, blocks, unavailable, action, summary`:

- integrity -- `STATE_CORRUPT, RECORD_CORRUPT, CATALOG_CORRUPT, SOURCE_INVALID,
  SOURCE_DOCUMENT_INVALID, SOURCE_DECLARATION_CONFLICT, SOURCE_CONTENT_UNSAFE`
- recovery -- `RECOVERY_REQUIRED, TRANSITION_PENDING, RECOVERY_DEFERRED, RECOVERY_BLOCKED,
  HOST_STARTUP_BLOCKED`
- trust -- `PROJECT_UNTRUSTED, TRUST_REQUIRED, TRUST_REVOKED, TRUST_EVIDENCE_INVALID`
- compatibility -- `COMPATIBILITY_INCOMPATIBLE`
- capability -- `RUNTIME_REQUIREMENT_UNAVAILABLE, CAPABILITY_EVIDENCE_UNAVAILABLE`
- configuration -- `CONFIGURATION_REQUIRED, CONFIGURATION_INVALID, SECRET_CUSTODY_UNAVAILABLE`
- activation -- `REVISION_UNAVAILABLE, PROJECTION_UNAVAILABLE, ACTIVATION_EVIDENCE_MISMATCH,
  RUNTIME_EVIDENCE_MISSING, MCP_REGISTRATION_MISMATCH, MCP_REGISTRATION_MISSING,
  RUNTIME_EVIDENCE_UNAVAILABLE`
- live-health -- `MCP_REMOTE_AUTH_REQUIRED, MCP_REMOTE_HEALTH_FAILED`
- update -- `UPDATE_STAGED, UPDATE_AVAILABLE, UPDATE_APPROVAL_REQUIRED, UPDATE_MANUAL_REQUIRED,
  UPDATE_AUTOMATIC_PENDING, UPDATE_CONFIGURATION_BLOCKED, UPDATE_CAPABILITY_BLOCKED,
  UPDATE_CLOCK_REGRESSED, UPDATE_RECOVERY_REQUIRED, UPDATE_FAILED`
- freshness -- `CATALOG_STALE, CATALOG_UNAVAILABLE, CANDIDATE_MISSING`
- evidence -- `SOURCE_UNAVAILABLE, EVIDENCE_UNAVAILABLE`
- adoption -- `ADOPTION_DOCUMENT_UNREADABLE, ADOPTION_DOCUMENT_CHANGED`

Findings are deduped, given deterministic ids (`native-diagnostic-v1:sha256:...`), sorted by
rank/severity, and rolled into a host condition `ready|degraded|unavailable|blocked`. Remediation is
**not** free text -- it is a closed 9-token `action` vocabulary (`run-recovery, review-trust,
provide-configuration, reload-runtime, refresh-marketplace, inspect-source, retry-read,
review-update, trust-project`). Human rendering is one line per finding: `SEVERITY CODE - action`.

`inspection-failure-projection.ts` translates raw domain diagnostics into a fixed 8-token reason
vocabulary (`invalid-json, wrong-shape, missing-target, path-escape, field-conflict,
source-unreachable, content-mismatch, unreadable`) plus scrubbed provenance, so native error text
and causes never reach the public inspection surface.

No logger, no telemetry, no analytics anywhere. Their one durable log is
`<agentDir>/plugin-host/logs/hooks.jsonl` -- fire-and-forget, 512 KB-rotated, one JSON per line,
fields clipped to 256 chars.

**Ours:** no `doctor`/`health` command. Three read-only surfaces: `pending` (network-free reconcile
preview, writes nothing, byte-identical on repeated runs, renders `will install` / `will uninstall` /
`will enable` / `will disable` plus `(failed)` rows; marketplace adds are deliberately absent because
they are immediate); `list` (inventory across both scopes with the filter family, hash versions
rendered git-style as `v#<7hex>`); and `info` (resolved source, components enumerated from disk, the
per-handler `event(matcher) (unsupported)` breakdown for dropped hooks, and the resolver verdict;
network-free, a cold clone renders `(remote)` + `components: not resolved` unless `--fetch`).

Our notification model (`shared/notify.ts`) is the single sanctioned output surface -- direct
`ctx.ui.notify` is forbidden by ESLint and a grep gate. Fixed grammar:

```text
<glyph> <marketplace> [<scope>] (<status>) <marker>?
  <glyph> <name> [<scope>]? v<version>? (<status>) {<reasons>}?
```

Glyphs: `*` installed/positive, `o` not-installed-no-error, `(/)` blocked/error, `(-)`
partially-available, `(.)` remote, `(x)` disabled -- see `docs/output-catalog.md` for the exact
characters. 26 status tokens and ~40 reasons, both closed sets. Severity is first-match-wins from
contents: any `failed` -> error; any `manual recovery` -> warning; any non-benign `skipped` ->
warning; otherwise info. The reload trailer fires only on realized plugin transitions and is
structurally suppressed on the load-time reconcile cascade. Byte-exact 0/2/4/6 indent ladder, gated
by `tests/architecture/catalog-uat.test.ts` against `docs/output-catalog.md`.

Both projects therefore enforce a closed diagnostic vocabulary; theirs is organized as a doctor
registry, ours as a notification catalog.

---

## 14. Foreign-state adoption / import

**Theirs** reads a fixed set (`src/infrastructure/adoption/node-foreign-state-files.ts:7-26`):
`~/.claude/plugins/known_marketplaces.json` (every alias entry); `~/.claude/settings.json` (only
`extraKnownMarketplaces`); `$CODEX_HOME|~/.codex/config.toml` (only `[marketplaces.<alias>]` tables,
parsed with `smol-toml`, restricted to `{source_type, source, ref, sparse_paths, last_updated,
last_revision}`).

Adoption is provably read-only: the port exposes only `readAll`; the Node implementation calls only
`lstat`/`open(O_RDONLY|O_NOFOLLOW)`/`read`/`realpath`/`close`. Zero write syscalls in any
adoption/format module. **Claude and Codex installed-plugin caches are explicitly not read for
activation**, and foreign trust/credentials are never imported. Two-step flow: `adopt preview` then
`adopt import <candidate-id>... --yes`.

**Ours** (`orchestrators/import/`) reads four files, base + `.local` overlay per scope:
`<CLAUDE_CONFIG_DIR or ~/.claude>/settings.json` and `settings.local.json` (user scope), and
`<cwd>/.claude/settings.json` and `settings.local.json` (project scope). A relative or empty
`CLAUDE_CONFIG_DIR` is ignored with a warning. Strictly read-only against Claude's files. Two
sections extracted: **`enabledPlugins`** (only `value === true` imported; `false` silently skipped;
non-boolean warns) and `extraKnownMarketplaces`. Nothing else -- no permissions, no env, no hooks,
no MCP.

Marketplace source mapping accepts flat legacy `{directory}`, flat legacy `{github:{repo}}`, and
upstream nested `{source:{...}}` (`url`/`github`/`directory`). The `file` discriminator (remote
`marketplace.json` URL) is unmappable. `claude-plugins-official` is special-cased to
`anthropics/claude-plugins-official`. Cascade order per scope: marketplaces first (a source mismatch
blocks the marketplace and its dependent plugins), then plugins, with unexpected throws caught so
the loop continues. Write-back touches only our own files -- a single batched `claude-plugins.json`
patch per scope, including a repair pass re-declaring entries a previously failed write left
undeclared. One `notify()` per invocation. Default scope set is both.

**The delta:** they adopt marketplace *declarations*; we additionally adopt the actual installed
plugin set. For migration off Claude Code that is the difference between a one-command migration and
rebuilding the plugin list by hand.

---

## 15. Codex compatibility (theirs)

Parallel reader set under `src/formats/codex/` (manifest, marketplace, hooks, MCP, state) alongside
`src/formats/claude/`. Catalog paths: `.claude-plugin/marketplace.json` and
`.agents/plugins/marketplace.json` (Codex-native). Manifests: `.claude-plugin/plugin.json` and
`.codex-plugin/plugin.json`. Claude manifests additionally carry `strict` (manifest-vs-catalog
authority); Codex manifests additionally recognize `apps`/`connectors` (both unsupported).

Host precedence: `DEFAULT_HOST_PRECEDENCE = ["claude","codex"]`, user-settable via
`/plugins config host-precedence claude-first|codex-first`, applied at both catalog merge and bundle
reconciliation. Conflicting *runtime* component declarations between the two manifests produce a
`CLAIM_CONFLICT` diagnostic and drop only that entry (valid siblings survive); conflicting
*presentational* metadata resolves by precedence (marketplace entry -> Claude -> Codex). Dual-root
name disagreement is fatal to registration. Committed fixtures exist for both equivalent and
conflicting dual-host cases.

Codex skill presentation is a separate `agents/openai.yaml` file, metadata-only except recognized
invocation-policy keys.

We are Claude-only.

---

## 16. Process model (theirs)

There is **no separate plugin-host child process.** "Packaged plugin host" is an in-process
composition root (`src/composition/create-packaged-plugin-host.ts:132-877`) owning every service
inside Pi's own Node process. Started on `session_start`, disposed on `session_shutdown`, guarded by
a `Symbol.for("@nklisch/pi-plugins/composition-v1")` in-process registry so two compositions cannot
claim the same runtime. Pi `reload()` re-evaluates the module in the same process;
predecessor/successor handoff uses another `Symbol.for` reload broker.

"Packaged" means the npm package bundles and shape-verifies its own runtime siblings
(`bundledDependencies: ["@nklisch/pi-subagents"]`) so one `pi install` activates MCP + subagents
through verified wrappers, reusing Pi's already-loaded coding-agent/AI/TUI module identities rather
than a second Pi runtime tree.

Actual child processes are transient only: one `spawn()` per hook handler per event (max 8
concurrent) and `git` invocations during acquisition. MCP servers are spawned by their forked adapter
inside the same Pi process.

The "control channel" is two in-process facades, not IPC: `PiControlChannel` delivering frames via
Pi's `appendEntry` (rpc/json), stdout lines (print), or nothing (tui); and a JSON-lines headless
runner (`runNodeNativeControlHeadless`) reading an input document from stdin or a locked file. The
headless runner is exported but has **no `bin` entry** -- no standalone CLI ships.

---

## 17. LLM-facing tools

Ours (`edge/handlers/tools.ts`): exactly two, both read-only; mutating tools are explicitly out of
scope.

1. `pi_claude_marketplace_list` -- no params. Returns `[<scope>] <name> -- <N> plugin(s) --
   <source.logical>` per marketplace plus structured `details.marketplaces`.
2. `pi_claude_marketplace_plugin_list` -- optional `marketplace`, `scope`, `installed`, `available`,
   `unavailable`. Returns rendered lines plus `details.plugins[]`, with the rich status set
   flattened to three buckets: `upgradable`/`partially-installed`/`partially-upgradable` ->
   `installed`; `remote` -> `available`; `partially-available`/`disabled` -> `unavailable`.

Tools never call `ctx.ui.notify`; they return `AgentToolResult`.

Whether they expose equivalent LLM-callable tools is UNVERIFIED.

---

## 18. Their self-documented limitations

- Slash commands not translated at all; Claude `agents/` not activated.
- LSP, monitors, themes, output styles, settings, channels, plugin dependencies, Codex
  apps/connectors: retained, never activated.
- Cross-marketplace plugin dependencies and the dependency graph / semver constraints are
  incompatible.
- ~17 Claude hook events retained-not-activated; `async` and `asyncRewake` retained-not-activated.
- MCP tool aliases unavailable; legacy SSE, WebSocket and `headersHelper` retained-not-activated.
- Git submodules fail materialization outright.
- No partial installation -- a plugin is all-or-nothing.
- Secret custody unconditionally unavailable on every platform.
- Trust review never live-probes remote MCP servers.
- `path-only` project identity explicitly tagged unstable.
- Staged-update finalization assumes a Pi reload is a full host restart; a warm-reload Pi would need
  a new finalization hook (acknowledged design gap).
- No trust-revocation command despite the domain primitive existing and being exported.
- No manual rollback command.
- Backlog `backlog-npm-sha1-integrity-fallback.md`: npm packuments lacking SHA-512 integrity
  hard-fail source resolution with no override, breaking pre-2015 packages and many private
  registries. The author's own audit calls the strict stance "ceremony" that "defends against
  nothing real."

### Their reliability track record (from CHANGELOG, unusually candid)

Three consecutive releases walked back over-aggressive fail-closed platform guards:

- **v0.2.3** -- `st_dev` treated as stable file identity; btrfs/overlayfs assign anonymous device
  numbers per mount, so every reboot changed device while files and inodes were unchanged. The host
  hard-failed startup with "SQLite database identity marker does not match its path" and project keys
  rotated each mount epoch, orphaning project-scoped state.
- **v0.2.4** -- removed the entire SQLite file-identity machinery (`.identity` markers,
  `.initializing` claims, root identity markers, device/inode validation, hard-link handle aliases,
  per-transaction root re-verification), which "false-positive-broke normal operation after every
  routine reboot ... while never catching a real replacement."
- **v0.3.4** -- removed a `statfs.f_type` magic-number filesystem-capability gate, described by the
  author as "the third round of the same anti-pattern in this adapter," which "fails closed on every
  real macOS APFS/HFS+ volume" and had been silently failing closed on Windows and FreeBSD the entire
  time.
- **v0.3.5** -- fixed macOS marketplace registration failing because staging required Linux `/proc`
  process-start evidence.

### Doc/code drift found in their tree

- README and ARCHITECTURE describe a five-section TUI that no longer exists (two views + four
  filters).
- README states pinned `@nklisch/pi-mcp-adapter@2.11.0-nklisch.0` while `package.json` and the
  runtime constant say `2.20.1-nklisch.0`.
- SPEC acceptance criteria reference `@nklisch/pi-subagents@18.0.4-nklisch.1` while `package.json`
  depends on `18.1.0-nklisch.0`.
- SPEC's component-verdict section still reads "incompatible blocks the plugin" while
  COMPATIBILITY.md's newer rule is "incompatible is reserved for security gates; everything else
  degrades to metadata-only."

---

## 19. Our own known limitations (for the symmetry section)

From `CLAUDE.md`, `.planning/PROJECT.md:337-358`, `docs/`, `CHANGELOG.md`:

- Claude `local` scope -- no Pi equivalent; exactly two scopes.
- `npm` plugin sources -- the only unsupported plugin-source kind.
- No SSH, no remote `marketplace.json` URLs, no sparse checkout, no browser `/tree/` URLs, no
  marketplace-level `git-subdir`.
- Components beyond skills/commands/agents/mcpServers/hooks -- surfaced, never installed.
- 20 Claude hook events; `http`/`mcp_tool`/`prompt`/`agent` handler types; full regex matchers; MCP
  wildcards; `${tool_input.*}`/`${user_config.*}` interpolation; `statusMessage`; `systemMessage`;
  `terminalSequence`; hook dedupe; settings.json hook surfaces; `disableAllHooks`.
- `asyncRewake` inert on Stop/StopFailure by design.
- `CLAUDE_ENV_FILE` is exposed but not sourced back.
- User-scope `${CLAUDE_PROJECT_DIR}` stays literal (unknowable at install time).
- No automatic dependency resolution -- declared `dependencies` produce a manual-install warning only.
- Custom component-path arrays replace rather than supplement the defaults (acknowledged spec
  deviation).
- No mutating LLM tools, no interactive selectors, no JSON output, no dry-run modes, no session-start
  autoupdate run, no managed/allowlist/blocklist policies.
- No telemetry, no message catalog, English only (dependency-gated by a test).
- Uninstall unconditionally `rm -rf`s the plugin data directory post-commit
  (`orchestrators/plugin/uninstall.ts:633`) -- there is no `--keep-data` equivalent.
- Known UX limitation: the reconcile cascade is visible at Pi startup but not after `/reload`,
  because the host TUI rebuilds the chat from the transcript and drops extension notifications.
  Workaround: run `pending` before reloading or `list` after.
- Accepted residual risks: TOCTOU between `assertPathInside` and the write; `retries: 0` makes two
  concurrent Pi sessions in one project noisy; `stale: 10_000` means a process suspended >10 s can
  have its lock stolen (blast radius limited to last-writer-wins by `write-file-atomic`).

---

## 20. Recommendation ordering to encode in the document

1. **Uninstall data disposition** (`--keep-data` / `--delete-data`). Smallest change; closes a real
   data-loss path where a plugin's `${CLAUDE_PLUGIN_DATA}` contents vanish silently.
2. **`userConfig` support.** Largest install-success gain per unit of work; reuses our existing
   `shared/vars.ts` substitution machinery. Skip sensitive-value custody initially -- their own
   implementation is fail-closed everywhere, so the non-sensitive subset is the shippable part.
3. **Update discovery and notices.** Maps onto `pending` and the notify catalog. Note the two design
   points worth copying: notification decoupled from auto-update policy, and preview-then-apply for
   policy changes.
4. **`doctor`.** Adopt the registry shape -- stable codes, closed remediation-action vocabulary --
   which slots into our existing closed status/reason catalog rather than fighting it.
5. **npm plugin sources.** Self-contained. Copy the packument/tarball/no-lifecycle-scripts approach;
   do not copy the SHA-512 absolutism their own backlog flags as harmful.
6. **Machine-readable output** (`--output json` on `list`/`info`/`pending`) plus a stable exit-code
   vocabulary.
7. **Content-bound trust grants.** Milestone-sized. Must ship together with a trust-continuity rule
   or every update breaks trust; also add the revoke verb theirs lacks.
8. **Interactive TUI manager.** Milestone-sized and highest visible impact. Read their v0.1.2 ->
   v0.1.5 changelog first: they rebuilt it three times.
9. **Portable project declaration + sync.** Team-onboarding story that partially overlaps our
   `claude-plugins.json` but is not complete in ours today.
10. **Codex compatibility.** Strategic, not urgent; roughly doubles addressable marketplaces.

Cautions to state explicitly in the document:

- Do not adopt their SQLite/lease/journal state machinery. Copy the *outcomes* (data-disposition
  choices, crash-recovery reporting), not the mechanism -- their changelog documents three rounds of
  the same fail-closed-guard anti-pattern breaking non-Linux platforms.
- Their Node >=24 floor is a direct consequence of `node:sqlite`. Our `>=20.19.0` floor is worth
  more than the state machinery it would buy.
- Their `git`-binary dependency buys submodule and credential-helper fidelity at the cost of
  portability. Our `isomorphic-git` choice is a deliberate trade, not an oversight.

---

## Style constraints for the final document

- Follow `.claude/skills/simple-english/SKILL.md` where practical: short sentences, active voice,
  one word one meaning.
- Prettier formats markdown at `printWidth: 100`; markdownlint and mdformat run in pre-commit.
- Cite competitor paths relative to `packages/pi-plugins/` and ours relative to the repo root.
- Pin the competitor snapshot (repo, commit, version) and the analysis date (2026-08-10) in the
  document header so the reader knows what it describes.
- Mark UNVERIFIED items as such. Do not assert them.
- No GSD milestone/phase references anywhere in the document.
