# pi-claude-marketplace

## Guidelines

### General

Before editing any file, read it first. Before modifying a function, trace its callers. Research before you edit.

### Git

- NEVER commit to the main branch.
- Branch names: `main`, `features/*`, `releases/*`, and `agent-*` for temporary agent worktree branches. New feature branches use `features/<name>`.
- Commit as `.agents/skills/committing/SKILL.md` describes: its message format also applies to PR titles. NEVER use `--no-verify` to skip the hooks.
- NEVER rebase, never rewrite history. Update branches by merging.
- When writing PR descriptions, use the `simple-english` skill in Plain mode and the `humanizer` skill, if available.
- Always use `--squash` when merging PRs (`gh pr merge --squash`). The repository does not allow merge commits or rebase merges.
- Before merging a PR that ships a GSD milestone, audit and close the milestone (`/gsd-audit-milestone`, then `/gsd-complete-milestone`) on the PR branch, so the archive lands in the same squash.

### GSD records

- Prefix each `gsd-tools windows append --description` with the milestone, such as `[workflows-replay]`. Phase numbers can repeat across milestones. Do not put the milestone in `--phase` or hand-edit `.planning/WINDOWS.md`.
- Include `## Threat Flags` in every plan `SUMMARY.md`, even when the answer is "None":

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

### Build verification

Read `.agents/skills/local-verification/SKILL.md` when planning or running checks. A build input is a file that a build or a CI job reads. When a staged file is a build input, the pre-commit hook runs `npm run check:commit`. It runs the static checks, the unit tests that have no source pair, and direct coverage for the staged source-test pairs. It runs all pairs when the commit stages shared test support, the test tooling, or a dependency file. A passing hook is not a full verdict, and it cannot satisfy a GSD gate. GSD gates run `npm run check` on the combined tree: the post-merge gate of each wave, the phase gate, the merge gate, and the final PR or release handoff. `npm run check` runs what pull request CI runs, except the e2e tests and ESLint with an empty cache. A merge does not run the hook. So a quick task that commits a build input runs `npm run check` in the main checkout after its worktree is merged, before the task finishes. A gate can reuse a passing result for the same inputs, as the skill defines. This project policy governs the TypeScript and GSD skill instructions.

### Behavioral tests

A change to `/claude:plugin` behavior that a user can see ships with a cucumber scenario under `features/` that fails without the change. Unit tests and direct coverage do not replace it. The `cucumber` skill says how to write the scenario.

### Versioning

Before creating a PR, offer to bump the version in `package.json` and `sonar-project.properties` and update `package-lock.json`. Concisely record changes in `CHANGELOG.md`

<!-- GSD:project-start source:PROJECT.md -->

## Project

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artifacts (skills, commands, agents, hooks, MCP servers, workflows) into the equivalent Pi-native artifacts (Pi skills, Pi prompt templates, pi-subagents agents, staged Pi hook registrations, pi-mcp-adapter MCP entries, saved workflow-engine scripts) and manages their lifecycle (install, update, uninstall, reinstall, marketplace add/remove/list, import).

**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

### Constraints

- **Upstream parity:** Claude Code's behavior is the default for every user-visible decision, because this extension installs real Claude plugins and anything it does differently is something a user already learned upstream and must unlearn. Exactly two things license a divergence: a recorded project decision carried here with an ID (SC-1, for instance), or a Pi capability gap that makes parity unavailable. Neither "upstream looks wrong" nor "our way is simpler" qualifies -- those go to the user as a question. Research the upstream contract with `.agents/skills/claude-code-compat-research`.
- **Runtime:** Node `^22.22.2 || ^24.15.0 || >=26.0.0` (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@earendil-works/pi-coding-agent` peer dependency, pinned to `>=1.0.0` (dev `^1.0.0`); the NFR-11 floor-pinning SHOULD is now satisfied
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `/claude:plugin apply`, then `/reload`, must suffice (NFR-2, amended by APL-D2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy (NFR-5, amended by url-source, by D-03-03, by D-MF-04, by AAP-D1, by D-PL5-08, by D-PL8-01, and by D-PL9-10):** Network is required only for git-source `marketplace add`/`update`, and for `install`/`update`/`reinstall` of git-source plugins **on cache miss only** -- warm sha-pinned cache operations stay offline. Resolving a dependency that carries a version constraint may additionally read that dependency's source repository tag list over the network, even when a cached or otherwise resolvable copy of that dependency already exists, because the constraint can demand a different tag than the cached one (D-03-03). A project-scope install that needs a marketplace only the user scope records adds it to the project through the `marketplace add` code, so a git-source marketplace is cloned once from the network on that install (D-MF-04). A load with `autoapply` on runs `apply`, so it may use the network as `apply` does (AAP-D1). Network is also required for `marketplace add` and `marketplace update` of a hosted-manifest marketplace (an https URL to a `.json` catalog), which download its `marketplace.json`, including the autoupdate cascade, an `apply` that adds or refreshes one, and a project-scope install that adds it to the project through the `marketplace add` code (D-MF-04, D-PL5-08, D-PL5-20). Installing from a hosted marketplace reads the stored copy. The background autoupdate pass runs `marketplace update`'s code for each marketplace with autoupdate on, so it may use the network as that command does, with stored credentials only (D-PL8-01, D-PL8-12). An operation that materializes a plugin through the install ledger or the shared update runner (install, update, reinstall, enable, import, apply, and the dependency installs and moves they cascade into) may run that plugin's own package manager, which reaches the plugin's package registry, when the plugin root lies inside `<scopeRoot>/pi-claude-marketplace/`, ships `package.json` listing dependencies with a supported lockfile, and has no `node_modules`; an update to a new revision always runs it (D-PL9-10). `list`, `info`, `uninstall`, `marketplace remove`, and a load without `autoapply` MUST NOT touch the network. A path-source plugin reaches the network only through the package install above, and only when its root lies inside a cloned marketplace (D-PL9-10)
- **Containment (NFR-10, re-anchored by url-source):** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp-adapter.json`, or `<scopeRoot>/mcp.json` (kept for legacy entries); plugin roots must resolve inside their **owning clone root** (marketplace clone for `path` sources, `plugin-clones/<key>/` for git sources)
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + `fallow` (dead code, health, duplication) + Prettier + source/test pairing + unit tests + integration tests + 100% direct coverage for every source-test pair (NFR-6)
- **Output channel:** Use exactly one mode-selected transport: `tui`/`print` use `ctx.ui.notify(message, severity)`; `json`/`rpc` use the JSON strategy through `pi.appendEntry`. Direct `process.stdout`/`process.stderr` writes remain forbidden in command/bridge code (IL-2, PROJECT.md D8). Single sanctioned `console.warn` is the load-time legacy migration save failure (IL-3)
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
