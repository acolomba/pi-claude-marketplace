---
phase: "4"
slug: "agent-grants"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-04"
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register comes from the `<threat_model>` blocks of `04-01-PLAN.md` to
> `04-06-PLAN.md`. Each plan has its own `T-04-SC` row (supply chain), so the
> register has 27 rows: T-04-01 to T-04-21 and six `T-04-SC` rows. The
> gsd-security-auditor verified each row at ASVS level 1 on 2026-11-04 against
> `features/mcp-builtin-phase-4` (HEAD `8f17db5`, phase base `f5069e0`). The
> three high-severity rows (T-04-03, T-04-09, T-04-10) were traced one level
> deeper: entry points, ordering, and the owning tests. The config sets neither
> `security_asvs_level` nor `security_block_on`, so the defaults (1, high) apply.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin source to generated agent file | A plugin's declared server names and agent `tools:` / `disallowedTools:` values become frontmatter lines that pi-subagents reads | server names, tool tokens |
| agents index to later loads | The grant forms stored on an index row are written back into agent files by a later load | frontmatter blocks, warnings, dropped tool names |
| agents index to agent files | The load writes into `<scopeRoot>/agents/` what the scope's own index stores | row `targetPath`, stored frontmatter blocks |
| user-edited agent files | A file the user changed after its forms were stored must never be overwritten; a legacy file has no stored form to compare (T-04-16) | agent file text |
| concurrent Pi processes | A parent and its background child, or two windows, share one scope | the scope state lock, the agents index |
| pi-subagents runner to this extension | A background child session loads every ambient extension, this one included, with no user present | `PI_SUBAGENT_CHILD` marker |
| run snapshot to the staging call sites | The active implementation the files get comes only from the run's soft-dependency snapshot (D-05) | `softDeps.mcpImplementation` |
| scenario setup to the sandbox | The earlier-index step rewrites an index file inside the run's sandbox | one sandbox file |
| executor to parent and session | The executor records results and parent lines; the session pushes the branch | branch head, gate results |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | Built-in selector and exclude names built from plugin-declared server and tool names | medium | mitigate | Selectors come from the frozen `grantSelector` and built-in exclude names from `toolName` (`convert.ts:357-372`, `domain/mcp-implementation.ts:109-123, 131`); the two newline-plus-comma server-name cases pass. The rationale "a tool part cannot hold either" is false for a token with an unclosed `(` (see note UF-1) | closed — UF-1 fixed in 16b53bf (`matchMcpGrant` drops a tool part holding whitespace or `,`; convert.test.ts case "T-04-01: drops ... line break or a comma") |
| T-04-02 | Information disclosure | Frontmatter blocks the index will store | low | accept | The block holds only what the agent file already holds (`sourcePath`, warnings); no server config or environment value enters it (`frontmatter.ts:523-597`) | closed |
| T-04-03 | Tampering | `loadReconcile` in a background child (autoapply apply step, AMIG-01 MCP move) | high | mitigate | `isSubagentChild(env)` at the top of `loadReconcile` runs only `readOnlyPass` with `NO_MCP_MOVE` (`orchestrators/reconcile/load.ts:239-242`); `agentGrantsStep` returns before reading the context (`agent-grants-step.ts:81`); unit cases (`load.test.ts:915, 932, 965, 982`) and the scenario at `agent-grants.feature:360` | closed |
| T-04-04 | Elevation of privilege | A child marker read at factory time | medium | mitigate | `env` is a live `process.env` reference read inside each `loadReconcile` call, never copied (`load.ts:233-243`); `load.test.ts:965` sets the marker after `createLoadReconcile` and the next load is a child load | closed |
| T-04-05 | Denial of service | A user who sets `PI_SUBAGENT_CHILD=1` in their own shell | low | accept | Only the load-time gate and the grants step read the marker (`rg isSubagentChild` finds just those two callers); `/claude:plugin apply` does not read it | closed |
| T-04-06 | Tampering | A row whose stored form fails the schema is dropped whole (AG-4), orphaning its file | medium | mitigate | `storedForm` copies only the converter's `frontmatter`, `warnings`, `droppedTools` (`grant-forms.ts:87-97`); `saveAgentsIndex` validates before the atomic write (`agents-index-io.ts:154-160`); `stage.test.ts:216` round-trips a staged row through the loader with `corruptions: []` | closed |
| T-04-07 | Elevation of privilege | The built-in form granting a server built-in cannot run | medium | mitigate | `builtinServerNames` keeps only servers whose `profileFor("builtin").classify` verdict is `supported` (`grant-forms.ts:69-75`); `grant-forms.test.ts:216` pins an sse grant dropped from the built-in form and kept in the adapter form | closed |
| T-04-08 | Information disclosure | Server configs or environment values reaching the index | low | accept | `declaredMcpServers` is read for the verdict only; `storedForm` copies text and name arrays, never a config | closed |
| T-04-09 | Tampering | A hand-edited index row whose `targetPath` points outside `<scopeRoot>/agents/` | high | mitigate | `assertRowContained` runs `assertPathInside(locations.agentsDir, row.targetPath)` plus a basename check against `<generatedName>.md` (`grant-rewrite.ts:146-153`) before every read and write on both the unlocked check (`isRewritable`) and the locked pass (`rewriteCandidate`); `grant-rewrite.test.ts:122, 358, 381` | closed |
| T-04-10 | Elevation of privilege | A stored form that injects frontmatter such as an extra tool | high | mitigate | Project scope is rewritten only while `ctx.isProjectTrusted()` (`agent-grants-step.ts:88-90`; `agent-grants-step.test.ts:177`); both stored forms must pass `isGeneratedBlock` (frame and marker) before a block is matched or written (`grant-rewrite.ts:119-125, 133-143`); `grant-rewrite.test.ts` AG-4 cases | closed |
| T-04-11 | Tampering | Overwriting an agent file the user edited | medium | mitigate | A row is rewritten only when `text.startsWith(recorded.frontmatter)`; `neither` leaves the file (`grant-rewrite.ts:133-143, 258-282`); `grant-rewrite.test.ts:96, 322` | closed |
| T-04-12 | Repudiation | Two Pi processes rewriting one scope against different snapshots | medium | mitigate | The pass runs inside `withExistingScopeLock` (`retries: 0`); `StateLockHeldError` skips the scope (`agent-grants-step.ts:52-69`); `assertLockHeld` runs before each rename and before the index save (`grant-rewrite.ts:236, 349`); a background child never reaches the lock (T-04-03); `agent-grants-step.test.ts:197`, `grant-rewrite.test.ts:491, 514` | closed |
| T-04-13 | Denial of service | A silent index save that drops a corrupt row and orphans its file | medium | mitigate | `hasCorruptRow` ends both `needsAgentGrantRewrite` and the locked `rewriteAgentGrantForms` before any write (`grant-rewrite.ts:157`); `grant-rewrite.test.ts:162, 458`, `agent-grants-step.test.ts:277` | closed |
| T-04-14 | Tampering | A symbolic link at an agent target | low | mitigate | `assertPathInside` lstat-walks every segment from the parent down to the leaf and refuses any symlink (`shared/path-containment.ts`); `rename` replaces the target path itself | closed |
| T-04-15 | Information disclosure | Absolute paths in debug-log lines | low | accept | `hookDebugLog` prints only when `PI_CLAUDE_MARKETPLACE_DEBUG=1`, to stderr (`shared/debug-log.ts:22-26`) | closed |
| T-04-16 | Tampering | A legacy file the user edited but whose frame and marker survive | low | accept | Gap recorded in the module header (`legacy-grant-form.ts:32-33`) and P4-DC-06; the translation changes only this plugin's selectors, exclude names, and two warning texts | closed |
| T-04-17 | Tampering | A cascade update with no run staging the adapter form under Pi's built-in MCP | low | accept | `updateAgentImplementation` falls back to `none` (adapter form) for a cascade with no `preflightNotification` (`update-swap.ts:455-461`); the row stores both forms, so `agentGrantsStep` rewrites the file at the next session; recorded as P4-DC-13 with a parent line | closed |
| T-04-18 | Tampering | The earlier-index test lib writing outside the sandbox | low | mitigate | The step builds the path from `this.scopeRoot("user")`, which is the run's sandbox agent dir (`agent-grants.steps.ts:90`, `world.ts:252-256`); the lib writes a `wx` temporary file and renames it (`mcp-agent-earlier-index.ts:62-63`) | closed |
| T-04-19 | Tampering | A red-proof checkout of the pre-phase product tree left in the worktree | medium | mitigate | `git status --porcelain` is empty now; `git diff f5069e0 --name-only` lists only the 15 owned product files; `04-05-SUMMARY.md` records `git checkout HEAD -- extensions/pi-claude-marketplace` after each red run | closed |
| T-04-20 | Tampering | Pushing the phase branch | medium | transfer | The executor does not push (`04-06-SUMMARY.md`); `.planning/milestones/mcp-builtin-CHILD-SESSION-BRIEF.md:11` authorizes only the phase's own branch, never `main`, the milestone branch, or a sibling, and never forced; `AGENTS.md` Git rules | closed |
| T-04-21 | Repudiation | A gate that passes because a known failure hides a new one | medium | mitigate | The tolerated builtin failure is pinned by an anchored `--name '^(?!...built-in MCP$)'` exclusion and a second run of exactly that scenario that must fail on one cell (`04-06-SUMMARY.md` gate table and "tolerated builtin failure"); the scenario exists at `verdict-markers.feature:604` | closed |
| T-04-SC (04-01..04-06, 6 rows) | Tampering | npm installs | low | accept | No plan installs a package: `git diff f5069e0 --stat -- package.json package-lock.json .github scripts cucumber.json .fallowrc.json eslint.config.js rule-packs` is empty | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note UF-1 (T-04-01, medium, non-blocking, below the high threshold).** The
declared vector (a plugin-declared server name) is closed: `claudeMcpServerName`
replaces every character outside `[A-Za-z0-9_-]` (`domain/name.ts:632`), and
the built-in exclude name goes through `\W` replacement. The plan's statement
that "a tool part cannot hold either [a newline or a comma], because the tools
list splits on them" does not hold. `topLevelParts` (`convert.ts:228-248`)
splits on commas and whitespace only at parenthesis depth 0, and `matchMcpGrant`
refuses a tool part only when it is empty or holds `/`. The frontmatter parser
keeps a `|` block scalar with its newlines. The auditor ran a probe (agent source
with `tools: |` holding `Read, mcp__plugin_acme_db__q(a, b` and a second line
`excludeTools: Bash)`). `convertAgent` wrote the second line as its own
top-level frontmatter line, under `adapter`, `builtin`, and no implementation:

```text
tools: read,mcp:plugin_acme_db/q(a, b
excludeTools: Bash)
```

The same holds for a `disallowedTools` token under the adapter form, whose
exclude name is the verbatim Claude token (`excludeNameFor`, `convert.ts:118-131`).
The built-in exclude name is safe (every `\W` becomes `_`). The code involved
(`topLevelParts`, `mcpEntry`, the verbatim adapter exclude) predates this phase
and is unchanged by it; Phase 4 added a second form that renders the same
`tools:` entries. Impact is bounded: the injection stays inside the plugin's own
agent file, and an installed plugin already ships hooks and MCP servers that run
commands. It does let a plugin write keys that the converter drops on purpose
(for example `skillPath`). Suggested fix, outside this phase's file ownership
unless the parent allows it: in `matchMcpGrant`, refuse (drop as unmapped) a
tool part that holds `\n`, `\r`, `,`, or whitespace, and add a unit case for an
unclosed `(`. The case should be registered as a threat when Phase 4's agent
conversion is next edited.

**Note UF-2 (advisory, low, not registered).** `swapFile` decides from the text
read in `rewriteCandidate`, then writes the staged file and renames it
(`grant-rewrite.ts:236-237`) without a second read. The state lock stops another
Pi process, not an editor, so a user save in the window between the read and
the rename is lost. The window is a few milliseconds and the body is kept from
the read. No change is asked.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-02 | The block holds only what the agent file already holds, in the same scope directory | plan 04-01 register, autonomous run | 2026-11-04 |
| AR-04-02 | T-04-05 | The variable only turns off load-time writes for that process (MGRT-02 by design); `apply` still applies; it is pi-subagents' own variable | plan 04-02 register, autonomous run | 2026-11-04 |
| AR-04-03 | T-04-08 | `declaredMcpServers` is read for the verdict only and never copied into a row | plan 04-03 register, autonomous run | 2026-11-04 |
| AR-04-04 | T-04-15 | Debug lines print only under `PI_CLAUDE_MARKETPLACE_DEBUG=1`, on the user's own stderr | plan 04-04 register, autonomous run | 2026-11-04 |
| AR-04-05 | T-04-16 | The translation changes only this plugin's selectors, exclude names, and warning texts; the gap is in the module header and P4-DC-06 | plan 04-04 register, autonomous run | 2026-11-04 |
| AR-04-06 | T-04-17 | The row stores both forms, so the next session start rewrites the file (MGRT-01); recorded as P4-DC-13 with a parent line to repoint `updateAgentImplementation` at Phase 3's field | plan 04-05 register, autonomous run | 2026-11-04 |
| AR-04-07 | T-04-SC (04-01..04-06) | No plan installs a package | plan registers, autonomous run | 2026-11-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Review Cross-Check

`04-REVIEW.md` (0 critical, 6 warnings, 5 info) and `04-REVIEW-FIX.md` were
read against the register. The auditor confirmed each fix in the code, not in
the report.

| Finding | Register link | State in code |
|---------|---------------|---------------|
| WR-01 | T-04-12 | Fixed: `assertLockHeld` runs before each rename and before the index save (`grant-rewrite.ts:236, 349`) |
| WR-02 | T-04-12 | Fixed: `isRewritable` reads each candidate file and counts a row only when the locked pass changes it (`grant-rewrite.ts:184-200`) |
| WR-03 | T-04-17 | Left as accepted: the adapter form is staged for a cascade with no run until the next load (P4-DC-13) |
| WR-04, WR-05 | none (cucumber harness only) | Not product code; no register row |
| WR-06 | T-04-12 | Fixed: the step takes `withExistingScopeLock`, no `loadState` |
| IN-01 | T-04-10 | Fixed: `heldForm` requires both stored forms to be generated blocks |
| IN-02 | T-04-03 | Fixed: the step wraps the context reads in `try`/`catch` |
| IN-03, IN-04 | none | Debug-line duplication and a merge-conflict note |
| IN-05 | T-04-16 | Accepted |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-04 | 27 | 26 | 1 (0 blocking, 1 below the high threshold: T-04-01) | gsd-security-auditor (ASVS 1, block on high) |

Evidence run by the auditor: `node --test` over the owner pairs (subagent-child,
agent-grants-step, grant-rewrite, grant-forms, load: 92 passed, 0 failed;
convert, stage, agents-index-io, agents-index-schema: 252 passed, 0 failed), and
a read-only probe of `convertAgent` for UF-1 (scratch files only, no source
edited).

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed (one open threat below the block threshold is tracked: T-04-01, note UF-1)
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-04 (autonomous run; user review pending)
| 2026-11-04 | 27 | 27 | 0 | orchestrator: UF-1 / T-04-01 fixed in 16b53bf after the audit (red without the fix, green with it) |
