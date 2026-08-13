# pi-claude-marketplace

## Guidelines

### Git

- NEVER commit to the main branch.

- Branch names: `main`, `features/*`, `releases/*`. New feature branches use `features/<name>`.

- Worktrees are preferred for new feature work; create them under `.worktrees/`.

- Git commit messages and PR titles: Follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/#specification). Titles must be at least 5 characters and no more than 72 characters. Body lines must be no more than 80 characters. Avoid GSD milestone/phases mentions.

- Run `pre-commit run --all-files` (or `pre-commit run --files <changed files>`) **before** attempting `git commit`. Fix any failures, restage, and re-run until clean. Do not commit and recover from hook failures after the fact -- a failed pre-commit hook means the commit did NOT happen, so iterating with `--amend` is wrong (it would alter the previous commit).

- NEVER use `--no-verify` to skip the hooks.

- NEVER rebase, never rewrite history. Update branches by merging.

- When committing from inside a worktree, prefix the commit with `SKIP=trufflehog`, but only after confirming the scan is clean by the filesystem route below. Do not extend `SKIP=` to other hooks.

  The hook entry is `trufflehog git file://. --since-commit HEAD --results=verified --fail` -- a **git-mode** scan. In a linked worktree `.git` is a text file holding `gitdir: <main>/.git/worktrees/<name>`, not a directory, so the scan cannot find `.git/index` and aborts with:

  ```text
  error preparing repo: failed to read index file: open <worktree>/.git/index: not a directory
  ```

  This is structural, not transient. `pre-commit run trufflehog --all-files` fails identically, so it does **not** confirm anything -- run a filesystem scan over the paths you are committing instead:

  ```bash
  TH=$(find "${PRE_COMMIT_HOME:-$HOME/.cache/pre-commit}" -type f -name trufflehog -perm -u+x | head -1)
  "$TH" filesystem <changed paths> --results=verified,unknown --fail
  ```

  `filesystem` mode scans file contents rather than git history, which is the right question at commit time: do the files being committed contain secrets. `--results=verified,unknown` is deliberately stricter than the hook's `verified`-only setting, because unverifiable candidates still warrant a look. Exit 0 with `verified_secrets: 0` and `unverified_secrets: 0` is the clean result. Committing from the main checkout is unaffected -- the hook works normally there.

- When writing PR descriptions, use the `humanizer` skill if available.

- Always use `--squash` when merging PRs (`gh pr merge --squash`). The repository does not allow merge commits or rebase merges.

### Versioning

Before creating a PR, offer to bump the version in `package.json` and `sonar-project.properties`, update `package-lock.json`, and succintly record changes in `CHANGELOG.md`.

<!-- GSD:project-start source:PROJECT.md -->

## Project

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artifacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artifacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, reinstall, marketplace add/remove/list, import).

**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

### Constraints

- **Runtime:** Node >= 20.19.0 (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@earendil-works/pi-coding-agent` peer dependency, pinned to `>=0.80.5` (dev `^0.83.0`); the NFR-11 floor-pinning SHOULD is now satisfied
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy (NFR-5, amended by url-source):** Network is required only for git-source `marketplace add`/`update`, and for `install`/`update`/`reinstall` of git-source plugins **on cache miss only** -- warm sha-pinned cache operations stay offline. `list`, `info`, `uninstall`, `marketplace remove`, and path-source operations MUST NOT touch the network
- **Containment (NFR-10, re-anchored by url-source):** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`; plugin roots must resolve inside their **owning clone root** (marketplace clone for `path` sources, `plugin-clones/<key>/` for git sources)
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + Prettier + tests (NFR-6)
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

| Skill                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Path                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| simple-english                       | \| Write or rewrite technical text with the rules of ASD-STE100 Simplified Technical English so it is clear, unambiguous, and free of AI slop. Use for documentation, READMEs, runbooks, procedures, error messages, release notes, incident reports, and API guides. Also use when the user says "STE", "Simplified Technical English", "ASD-STE100", "de-slop", "make this readable", "write for non-native readers", or asks for docs that translate well. Enforces the standard's 53 rules: 20/25-word sentence limits, one word one meaning, simple tenses, active voice, condition before command. | `.claude/skills/simple-english/SKILL.md`                       |
| spike-findings-pi-claude-marketplace | Implementation blueprint from spike experiments on pi-claude-marketplace -- backward-compat migration removal, Claude plugin dependency-declaration handling, and progress-message UI for long-running operations. Requirements, proven patterns, and verified knowledge for all three. Auto-loaded during implementation work on any of them.                                                                                                                                                                                                                                                           | `.claude/skills/spike-findings-pi-claude-marketplace/SKILL.md` |

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
