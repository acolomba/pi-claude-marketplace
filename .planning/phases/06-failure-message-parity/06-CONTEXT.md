# Phase 6: Failure-Message Parity - Context

**Gathered:** 2026-11-28
**Status:** Ready for planning

<domain>
## Phase Boundary

When a git clone, fetch, or freshness `ls-remote` fails, the notice tells the Pi user what went wrong and how to fix it. The notice covers the same failure classes and remedies that Claude Code 2.1.332 shows, in Pi's own wording. No notice, JSON-mode output, or debug log shows a credential (SG-ERR-01, SG-ERR-02).

The surfaces are:

- `marketplace add`;
- `marketplace update` and the PUP-2 sync;
- git-source plugin install, update, and reinstall, and the dependency moves (D-SG-19 surfaces);
- the `apply` and `import` cascades;
- the background autoupdate pass.

This phase adds no new failure kinds and no new transports. It changes no retry rules (D-SG-18, D-SG-22) and no reason tokens (D-PL7-01).

</domain>

<decisions>
## Implementation Decisions

### Message form (Q4, maintainer 2026-11-28)

- **D-SG-31: keep Pi's notice grammar, and add a remedy sentence.**
  - The row keeps its `{reason}` token (D-PL7-01).
  - The row keeps the typed cause line `git <op> failed: <kind>, exit code N` from `GitCommandError.message` (`shared/errors.ts`).
  - For each failure class that Claude Code gives a remedy, the cause chain adds one remedy sentence. The classes are: timeout, SSH host key changed, SSH host key unknown, SSH auth, HTTPS auth, network, and empty stderr.
  - Pi does NOT adopt upstream's `Failed to clone marketplace repository:` / `Failed to clone repository:` / `Failed to refresh marketplace '<name>':` wrapper sentences in place of its own row grammar. The already-verbatim both-transports-failed wrappers (D-SG-22, OQ-8) stay as they are.
  - A single-attempt `marketplace add` row that fails on a git command now always carries a cause line. Today it shows only `{reason}` (`orchestrators/marketplace/add.ts:1468-1521`, `failedAddRow`/`showsAddCause`).
  - This diverges from upstream's exact text. That is recorded as D-SG-31.
  - **Reversibility:** reversible. These are message strings only. Scenarios pin them, but no stored schema holds them.

- **D-SG-32: git's stderr is shown under Pi's convention for child-process output.** The maintainer chose "do whatever we were doing with pi by convention". The convention is the plugin package-install failure note (`orchestrators/plugin/package-install.ts:393-424`, D-PL9-10). That note shows the tool's own stderr, falling back to stdout, compacted by `compactOutput` and length-bounded by `boundedNote`. Apply the same rule to git failures:
  - every git failure's cause chain ends with git's stderr;
  - the stderr is compacted and bounded the same way;
  - the stderr is redacted first (D-SG-35);
  - an empty stderr shows nothing extra; its class remedy covers it.
  - This also covers the classes that have no remedy sentence (D-SG-34).
  - **Reversibility:** reversible.

### Wording (Q4, maintainer 2026-11-28)

- **D-SG-33: rephrase every upstream remedy sentence in plain English.** Do not copy Claude Code's text verbatim, including the sentences that do not name Claude Code. Write each sentence with the `simple-english` skill (Plain mode) and the `humanizer` skill.
  - Each sentence must keep upstream's facts and remedy: what failed, and the command or setting that fixes it.
  - Keep every command and setting name exact, for example `ssh-keygen -R <host>`, `ssh -T git@<host>`, `gh auth login`, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, and the example value 300000.
  - Never write "Claude Code" where Pi is meant. Upstream's "Claude Code runs this clone with terminal prompts … turned off" becomes a true statement about this extension (D-SG-05).
  - Upstream's `Run with --debug` becomes `PI_CLAUDE_MARKETPLACE_DEBUG=1` (`shared/debug-log.ts`).
  - The plugin remedy's `Then install again.` must fit the verb that shows it (install, update, reinstall), or be neutral.
  - The macOS git-missing text and `Git is required to install marketplaces.` stay as D-SG-07 set them.
  - Each remedy shows its value in seconds, rounded from the millisecond limit (D-SG-13).
  - The `<host>` / `GitHub` / "your git host" choice follows upstream's rules (the scp form for host-key messages; `gitHubAddressOf` and the base override for GitHub).
  - **Reversibility:** reversible.

- **HTTPS auth: one message.** Every HTTPS auth failure gets the same rephrased remedy sentence. That covers a refused stored credential (GAUTH-04), no credential, and a bare 401/403.
  - The remedy names a credential helper: `gh auth login` for GitHub, and a personal access token in a credential helper for another host.
  - Retire the D-1-02 recipe `printf '…' | git credential approve` (`NO_STORED_CREDENTIAL_CAUSE`, `orchestrators/auth-host.ts`) and the GAUTH-04 `<host> rejected the stored credential` cause text from every cause line.
  - Record the amendment of D-1-02 and GAUTH-04 in PROJECT.md.
  - The `rejected` / `no-credential` detail stays internal (D-SG-26 still reads it).
  - The Phase 3 WR-02 classification (a bare 401/403 reads `https-auth` / `no-credential`) stays as is, because it no longer changes any visible text.
  - This follows upstream. Its wording is still rephrased under D-SG-33.

- **D-SG-34: classes with no upstream remedy get git's redacted stderr only.** Upstream shows git's raw stderr for these classes:
  - dubious ownership, git too old, protocol refused, not a repository;
  - ref missing, commit missing;
  - not found, 5xx, TLS, connection refused;
  - `aborted`, `refused-input`, `pin-mismatch`, `failed`.

  Pi shows the row grammar and the typed cause line, then git's redacted, compacted stderr (D-SG-32). Pi writes no remedy of its own for these classes. The roadmap expected a dubious-ownership message, but upstream has none on this surface, so none is added.

### Consistency

- Each reason and remedy comes from the typed failure kind (`platform/git-failure-kind.ts`, `shared/git-failure-classifiers.ts`). So the command's own notice, the `apply` and `import` cascades, and the background autoupdate pass show the same reason and remedy for the same failure (success criterion 2).

### Redaction (SG-ERR-02)

- **D-SG-35: one redaction pass for every shown stderr and every debug line.**
  - The order follows upstream's `rRe`. First, replace each credential-bearing spelling of the request URL. Then run `redactCredentials`. Then run `redactAbsolutePaths`.
  - Widen `redactCredentials` (`shared/redact-credentials.ts`) to cover:
    - URL query and fragment tokens (`?private_token=`, `#…`);
    - GitLab `glpat-` tokens;
    - `Authorization: Basic` values;
    - percent-encoded userinfo;
    - the other provider token shapes upstream's `Gg` table lists, where they have a fixed prefix.
  - `hookDebugLog` (`shared/debug-log.ts`) redacts every line centrally. Fix the raw `subject` / `plan.first.url` / `run.subject` lines in `orchestrators/marketplace/clone-swap.ts` and `orchestrators/github-transport.ts`.
  - `GitCommandError.message` keeps stderr out. The stderr is redacted when the error is built and again when the cause chain is serialized.
  - git's output still never reaches stdout or stderr directly (`platform/process-run.ts` pipes it).

### Claude's Discretion

- Where the kind-to-remedy mapping lives: `shared/git-failure-classifiers.ts`, or a sibling module that reason resolution already reads.
- How a multi-line cause renders in the `cause:` line and the JSON wire. Strings change and the schema stays the same.
- Trigger precedence: Pi keeps its own anchored kinds and applies upstream's remedy per kind.
- Test layout: one cucumber scenario per class that gets a remedy, across `marketplace add`, `marketplace update`, and plugin install; one scenario for the stderr-only classes; and cascade checks for `apply`, `import`, and autoupdate. Also add a scenario that shows a credential in a URL and in stderr is redacted in the notice, in JSON mode, and in the debug log.
- Updates to `docs/messaging-style-guide.md`, the README wording, and a CHANGELOG line.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` — the "Phase 6: Failure-Message Parity" section: goal, notes, success criteria
- `.planning/REQUIREMENTS.md` — SG-ERR-01, SG-ERR-02
- `.planning/PROJECT.md` — the D-SG-01..30, D-PL7-01/02/11, D-1-02, GAUTH-04, D-79-03, D-PL9-10, IL-1, IL-2, and IL-4 rows (grep for them; the file has 2,800+ lines)

### Upstream evidence
- `.planning/research/FEATURES.md` — E-SG-10, the upstream message table
- `.planning/phases/06-failure-message-parity/06-UPSTREAM-ANALYSIS.md` — the class table with upstream's exact 2.1.332 text, Pi's current text, the redaction gaps with file:line, and the settled decisions
- `.agents/skills/claude-code-compat-research/SKILL.md` — evidence rules. Grep `/opt/claude-code/bin/claude` (2.1.332); never run it

### Writing
- `.agents/skills/simple-english/SKILL.md` (Plain mode) and `.agents/skills/humanizer/SKILL.md` — required for every remedy sentence (D-SG-33)
- `docs/messaging-style-guide.md` — Pi's notice grammar

### Prior phases
- `.planning/phases/02-git-process-seam-and-typed-failures/02-CONTEXT.md` — typed kinds, D-SG-07
- `.planning/phases/04-ssh-sources-and-transport-selection/04-CONTEXT.md` — D-SG-18/22, the transport notes
- `.planning/phases/05-credential-surface/05-CONTEXT.md` — D-SG-26..29, and the auth-hint wording deferred to this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrators/plugin/package-install.ts` `failureDetail` / `compactOutput` / `boundedNote`: the convention D-SG-32 copies for showing child-process stderr.
- `shared/redact-credentials.ts` `redactCredentials` and `shared/redact-absolute-paths.ts`: the passes D-SG-35 widens and orders.
- `shared/errors.ts` `GitCommandError` (redacted `stderr`, `kind`, `detail`), `GitHubTransportsFailedError`, and `serializeCauseChain`, which already redacts every link.
- `shared/git-failure-classifiers.ts`, `platform/git-failure-kind.ts`: the typed kind and the reason ladder.

### Established Patterns
- Row grammar `⊘ <subject> [scope] (failed) {reason}` plus `cause: a -> b`, rendered by `shared/notification-grammar.ts`. JSON mode reads the same serialized chain (`notification-json.ts`).
- All output goes through `notify()` (IL-2); English only (IL-1); no telemetry (IL-4).

### Integration Points
- `orchestrators/marketplace/add.ts` (`failedAddRow`, `showsAddCause`), `marketplace/update.ts`, `plugin/update-flow.ts`, the clone-cache failure rows, and the apply, import, and autoupdate cascade rows.
- Debug lines in `orchestrators/marketplace/clone-swap.ts:266,364-367,482,580,631`, `orchestrators/github-transport.ts:231,238,267`, and the other raw `errorMessage(err)` sites listed in 06-UPSTREAM-ANALYSIS.md §2.

</code_context>

<specifics>
## Specific Ideas

- The maintainer wants every upstream remedy reworded, not copied, "so they are not exactly like claude code's", while keeping their meaning and their exact commands.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within the phase scope.

</deferred>

---

*Phase: 06-failure-message-parity*
*Context gathered: 2026-11-28*
