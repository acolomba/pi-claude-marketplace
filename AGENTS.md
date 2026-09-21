# pi-claude-marketplace

## Guidelines

### General

Before editing any file, read it first. Before modifying a function, trace its callers. Research before you edit.

### Git

- NEVER commit to the main branch.
- Branch names: `main`, `features/*`, `releases/*`. New feature branches use `features/<name>`.
- Git commit messages and PR titles: Follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/#specification). Titles must be at least 5 characters and no more than 72 characters. Body lines must be no more than 80 characters. Avoid GSD milestone/phases mentions.
- Run `pre-commit run --all-files` (or `pre-commit run --files <changed files>`) **before** attempting `git commit`. Fix any failures, restage, and re-run until clean. Do not commit and recover from hook failures after the fact -- a failed pre-commit hook means the commit did NOT happen, so iterating with `--amend` is wrong (it would alter the previous commit).
- NEVER use `--no-verify` to skip the hooks.
- NEVER rebase, never rewrite history. Update branches by merging.
- When committing from inside a worktree, prefix the commit with `SKIP=trufflehog`.
- When writing PR descriptions, use the `simple-english` skill in Plain mode and the `humanizer` skill, if available.
- Always use `--squash` when merging PRs (`gh pr merge --squash`). The repository does not allow merge commits or rebase merges.

### Broken Windows ledger

When appending an entry with `gsd-tools windows append`, **prefix the description with the milestone in square brackets**: `--description "[workflows-replay] the thing that is wrong"`.

The ledger entry schema is `{id, kind, phase, file, line, description, status, reason, recorded_at, resolved_at}` -- it has no milestone field, and `phase` holds a bare number. Phase numbers are NOT unique across milestones in GSD (they are unique only within one active `phases/` directory; archiving moves completed phases into `milestones/<name>-phases/` and frees the numbers). This project has reused 101-105 across two milestones already, and v1.19's 108-117 overlap the current workstream's 109-117.

The consequence, seen for real: 20 entries recorded against "phase 115/116/117" belonged to an archived milestone, and nothing in the ledger could distinguish them from the current one's. Attributing them took dating every entry and cross-reading decision IDs. The bracket prefix costs nothing at write time and makes the whole set greppable by milestone.

Do NOT encode the milestone in `--phase` (e.g. `115@workflows-replay`) -- that field is grouped and numerically normalized by the readers. Do NOT hand-edit `.planning/WINDOWS.md` to retrofit old entries: the file carries a rendered table AND a fenced JSON block, the JSON is the source of truth, and a table-only edit is silently lost (this nearly destroyed two operator decisions).

### Threat Flags in SUMMARY.md

Every plan SUMMARY.md carries a `## Threat Flags` section, **even when the answer is "None."** GSD's executor template says to omit the section when the scan found nothing; do not. Write:

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

The reason is what an absent section means to the reader. `/gsd-secure-phase` cross-checks the plan's threat register against the surface the executor flagged, and an absent section is indistinguishable from an executor that never ran the scan. Across phases 109-113 of the workflows-replay milestone, zero of 21 summaries carried the section, so every one of those audits' cross-checks was vacuous -- and all four auditors flagged it independently rather than treating absence as evidence that no new surface appeared. An explicit "None" is a claim the auditor can hold the executor to; silence is not.

### TypeScript

Rules for TypeScript live under `skills/` and are not registered with any runtime; read the ones that apply before editing (skip any your prompt already carries under `<agent_skills>`):

- `skills/typescript-google-style-review/SKILL.md` and `skills/typescript-comments/SKILL.md` for every `.ts` file
- `skills/typescript-unit-testing/SKILL.md` (write) and `skills/typescript-unit-testing-review/SKILL.md` (check) for `tests/**/*.ts`

### Versioning

Before creating a PR, offer to bump the version in `package.json` and `sonar-project.properties` and update `package-lock.json`. Concisely record changes in `CHANGELOG.md`

<!-- GSD:project-start source:PROJECT.md -->

## Project

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artifacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artifacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, reinstall, marketplace add/remove/list, import).

**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

### Constraints

- **Runtime:** Node >= 20.19.0 (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@earendil-works/pi-coding-agent` peer dependency, pinned to `>=0.80.5` (dev `^0.84.2`); the NFR-11 floor-pinning SHOULD is now satisfied
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy (NFR-5, amended by url-source):** Network is required only for git-source `marketplace add`/`update`, and for `install`/`update`/`reinstall` of git-source plugins **on cache miss only** -- warm sha-pinned cache operations stay offline. `list`, `info`, `uninstall`, `marketplace remove`, and path-source operations MUST NOT touch the network
- **Containment (NFR-10, re-anchored by url-source):** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`; plugin roots must resolve inside their **owning clone root** (marketplace clone for `path` sources, `plugin-clones/<key>/` for git sources)
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + `fallow` (dead code, health, duplication) + Prettier + unit tests + integration tests (NFR-6)
- **Output channel:** All user-visible messages MUST go through `ctx.ui.notify(message, severity)`; direct `process.stdout`/`process.stderr` writes forbidden in command/bridge code (IL-2). Single sanctioned `console.warn` is the load-time legacy migration save failure (IL-3)
- **No telemetry V1:** No metrics, no event sink, no analytics endpoint (IL-4)
- **English only V1:** No message catalog, no locale negotiation (IL-1)
- **Scope model:** Exactly two scopes -- `user` (`~/.pi/agent/`) and `project` (`<cwd>/.pi/`). Claude Code's `local` scope is not introduced (SC-1). Marketplace records and plugin install records are scoped independently per D-29 / CMP-1..8.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

@.planning/codebase/STACK.md

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

@.planning/codebase/CONVENTIONS.md

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

@.planning/codebase/ARCHITECTURE.md

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Path                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| humanizer                      | \| Rewrite AI-sounding text so it reads naturally without changing what it says. Use when editing or reviewing prose for inflated claims, sales language, vague sources, repetitive structure, stock AI words, passive voice, filler, or chatbot artifacts. Based on Wikipedia's "Signs of AI writing."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `.agents/skills/humanizer/SKILL.md`                      |
| simple-english                 | \| Write or rewrite text in plain, layman-readable English in the spirit of ASD-STE100 Simplified Technical English: short sentences, active voice, simple tenses, one word one meaning, condition before command, every technical term defined at first use, no AI slop. Default mode is Plain. Strict mode applies full STE vocabulary compliance when the user names STE, ASD-STE100, or compliance. Use for documentation, READMEs, runbooks, procedures, error messages, release notes, incident reports, API guides, and explanations for readers outside the field. Also use when the user says "STE", "Simplified Technical English", "ASD-STE100", "plain English", "layman's terms", "explain it simply", "no jargon", "de-slop", "make this readable", "write for non-native readers", or asks for docs that translate well. The same rules govern the reply: answer first, five sentences or fewer. | `.agents/skills/simple-english/SKILL.md`                 |
| typescript-google-style-review | \| Review TypeScript source against the Google Style Guide as adapted for the Homebridge plugin template -- the rules the toolchain does not enforce. Use when reviewing or revising .ts files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `.agents/skills/typescript-google-style-review/SKILL.md` |
| typescript-unit-testing-review | \| Review TypeScript unit tests against the project's unit testing rules -- pairing, coverage, structure, assertions, test doubles, hermeticity, and testable production design. Use when reviewing or revising test/\*\*/\*.ts or the src modules they pair with.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `.agents/skills/typescript-unit-testing-review/SKILL.md` |

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Generated by GSD on 2026-05-14T01:19:44Z. This section is managed by `generate-claude-profile` -- do not edit manually. Full profile: `.pi/gsd/USER-PROFILE.md`

### Quick Reference

- **Communication Style (terse-direct, HIGH):** Respond directly and efficiently, leading with the answer or action before adding any optional context.
- **Decision Speed (deliberate-informed, HIGH):** Present concise trade-offs and a clear recommendation, then wait for or invite a decision when the choice has meaningful consequences.
- **Explanation Depth (detailed, HIGH):** Explain the reasoning and mechanics behind changes, but keep the explanation tightly focused on the specific question.
- **Debugging Approach (hypothesis-driven, MEDIUM):** Treat debugging as a reasoning session: state the suspected root cause, validate or refute the developer's hypothesis, and show why the fix changes the failure mode.
- **UX Philosophy (backend-focused, MEDIUM):** Prioritize correct behavior, clear data flow, and maintainable implementation; keep UI work simple and functional unless the developer asks for polish.
- **Vendor Philosophy (pragmatic-fast, MEDIUM):** Choose practical, working dependencies and integration paths first, and call out risks or alternatives only when they affect correctness, maintenance, or compatibility.
- **Frustration Triggers (instruction-adherence, LOW):** Follow the stated requirement precisely, avoid unnecessary deviations, and explicitly verify that proposed changes satisfy the user's intended constraint.
- **Learning Style (guided, HIGH):** Guide the developer through unfamiliar concepts with concise explanations and concrete examples tied directly to the current code or tool.

<!-- GSD:profile-end -->

<!-- CODEGRAPH_START -->

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call -- the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely -- indexing is the user's decision.

<!-- CODEGRAPH_END -->
