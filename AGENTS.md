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

### GSD records

- Prefix each `gsd-tools windows append --description` with the milestone, such as `[workflows-replay]`. Phase numbers can repeat across milestones. Do not put the milestone in `--phase` or hand-edit `.planning/WINDOWS.md`.
- Include `## Threat Flags` in every plan `SUMMARY.md`, even when the answer is "None":

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

### TypeScript

Rules for TypeScript live under `skills/` and are not registered with any runtime; read the ones that apply before editing (skip any your prompt already carries under `<agent_skills>`):

- `skills/typescript-google-style-review/SKILL.md` and `skills/typescript-comments/SKILL.md` for every `.ts` file
- `skills/typescript-unit-testing/SKILL.md` (write) and `skills/typescript-unit-testing-review/SKILL.md` (check) for `tests/**/*.ts`

### Versioning

Before creating a PR, offer to bump the version in `package.json` and `sonar-project.properties` and update `package-lock.json`. Concisely record changes in `CHANGELOG.md`

<!-- GSD:project-start source:PROJECT.md -->

## Project

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artifacts (skills, commands, agents, hooks, MCP servers, workflows) into the equivalent Pi-native artifacts (Pi skills, Pi prompt templates, pi-subagents agents, staged Pi hook registrations, pi-mcp-adapter MCP entries, saved workflow-engine scripts) and manages their lifecycle (install, update, uninstall, reinstall, marketplace add/remove/list, import).

**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

### Constraints

- **Upstream parity:** Claude Code's behavior is the default for every user-visible decision, because this extension installs real Claude plugins and anything it does differently is something a user already learned upstream and must unlearn. Exactly two things license a divergence: a recorded project decision carried here with an ID (SC-1, for instance), or a Pi capability gap that makes parity unavailable. Neither "upstream looks wrong" nor "our way is simpler" qualifies -- those go to the user as a question. Research the upstream contract with `skills/claude-code-compat-research`.
- **Runtime:** Node >= 20.19.0 (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@earendil-works/pi-coding-agent` peer dependency, pinned to `>=0.86.1` (dev `^0.86.1`); the NFR-11 floor-pinning SHOULD is now satisfied
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy (NFR-5, amended by url-source and by D-03-03):** Network is required only for git-source `marketplace add`/`update`, and for `install`/`update`/`reinstall` of git-source plugins **on cache miss only** -- warm sha-pinned cache operations stay offline. Resolving a dependency that carries a version constraint may additionally read that dependency's source repository tag list over the network, even when a cached or otherwise resolvable copy of that dependency already exists, because the constraint can demand a different tag than the cached one (D-03-03). `list`, `info`, `uninstall`, `marketplace remove`, and path-source operations MUST NOT touch the network
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

______________________________________________________________________

<!-- fallow:setup-hooks:start -->

## Fallow local gate

Before any `git commit` or `git push`, run `fallow audit --format json --quiet --explain --gate-marker agent`. If the verdict is `fail`, fix the reported findings before retrying. Treat JSON runtime errors like `{ "error": true, ... }` as non-blocking.

Audit defaults to `gate=new-only`: only findings introduced by the current changeset affect the verdict. Inherited findings on touched files are reported under `attribution` and annotated with `introduced: false`, but do not block the commit. Set `[audit] gate = "all"` in `fallow.toml` to gate every finding in changed files.

For non-skill agents, treat the task map below as the local onboarding source: run the listed fallow command before destructive edits, before commits, and before pull request handoff.

## Fallow task map

| When the agent is about to...                                     | Run                                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| delete an "unused" export or file                                 | `fallow dead-code --trace <file>:<export>`                                                                                                              |
| prove a TypeScript symbol's exact consumers before refactoring    | `fallow dead-code --type-aware --symbol-impact <file>:<export-or-class.method>`                                                                         |
| find how one module reaches another                               | `fallow trace --path <from> <to>` (Reports `reachable: false` instead of failing when no import path exists; type-only hops are reported, not skipped.) |
| delete an "unused" dependency                                     | `fallow dead-code --trace-dependency <name>`                                                                                                            |
| commit or open a PR                                               | `fallow audit --base <ref>`                                                                                                                             |
| read a diff before approving it                                   | `fallow review --base <ref> --brief` (orientation, never gates: deterministic and always exit 0, unlike the audit row)                                  |
| prioritize refactoring                                            | `fallow health --hotspots --targets`                                                                                                                    |
| ask who owns code                                                 | `fallow health --ownership`                                                                                                                             |
| check untested-but-reachable code                                 | `fallow health --coverage-gaps`                                                                                                                         |
| consolidate duplication                                           | `fallow dupes --trace dup:<fingerprint>`                                                                                                                |
| find feature flags                                                | `fallow flags`                                                                                                                                          |
| check which architecture rules apply to a file before changing it | `fallow guard <files>`                                                                                                                                  |
| surface security candidates                                       | `fallow security`                                                                                                                                       |
| understand a finding                                              | `fallow explain <issue-type>`                                                                                                                           |
| scope a monorepo                                                  | `--workspace <glob> / --changed-workspaces <ref>` (global flags, prefix any command)                                                                    |

<!-- fallow:setup-hooks:end -->
