# Upstream fix for Pi: let input transforms skip template expansion

Patch: `pi-input-transform-expand.patch` (one commit, made with `git format-patch`).
Repository: https://github.com/earendil-works/pi
Base commit: `c9f4c7b` (`main` on 2026-11-02). Local branch: `fix/input-transform-expand-opt-out`.

## The problem

An extension `input` handler can return `{ action: "transform", text }`. Pi then still
expands skill commands (`/skill:name`) and prompt templates (`/template`) in the
returned text. So if a handler already expanded a command itself, and the result
starts with `/`, Pi expands it a second time.

Example: pi-claude-marketplace emulates a Claude Code command. Claude Code sends the
command body as is, even when the body starts with `/review`. Pi sees the transformed
text `/review src/index.ts` and replaces it with the `review` prompt template.

`prompt()` and `sendUserMessage()` already take `expandPromptTemplates: false`. The
transform result had no such option. The only workaround was `sendUserMessage`, which
changes RPC semantics (the original prompt is no longer the one that runs).

## The change

- `InputEventResult` (`packages/coding-agent/src/core/extensions/types.ts`): the
  `transform` result takes an optional `expandPromptTemplates?: boolean`. The default
  is `true`, so existing extensions behave as before.
- `ExtensionRunner.emitInput` (`src/core/extensions/runner.ts`): carries the value
  through the handler chain. A later transform that omits the option keeps the value
  an earlier handler set, because the later handler sees text the earlier one may have
  expanded. A later handler can set `true` again. When any handler sets the option,
  the result is a `transform` even if the text did not change.
- `AgentSession` (`src/core/agent-session.ts`): `prompt()` and the queued path that
  `steer()` and `followUp()` use skip both expansions when the option is `false`.
- Docs: `packages/coding-agent/docs/extensions.md`, section `input`: processing
  order, results list, and a short example.

## How it was tested

- New tests:
  - `test/extensions-input-event.test.ts`: the runner returns the option for an
    unchanged text, keeps it across a later transform that omits it, and lets a later
    transform override it.
  - `test/suite/agent-session-prompt.test.ts`: with a loaded template and skill, a
    transform with `expandPromptTemplates: false` sends `/review ...` and
    `/skill:test ...` as is; without the option, both still expand.
  - `test/suite/agent-session-queue.test.ts`: the same for `steer()` (opt-out) and
    `followUp()` (default).
- All five new tests fail without the source change and pass with it.
- Related suites pass: `extensions-input-event`, `agent-session-prompt`,
  `agent-session-queue`, `input-transform-streaming-example`,
  `rpc-prompt-response-semantics` (65 tests).
- Full `packages/coding-agent` vitest run: 2870 passed, 17 failed in 7 files. The same
  17 fail without the change. They come from this sandbox: `models.dev` is blocked, so
  the model data was hydrated from the published `@earendil-works/pi-ai@1.4.0`, which
  is older than `main`'s catalog; and `fd` is not installed.
- `npm run check`: biome, pinned deps, runtime deps, ts imports, entry graphs, install
  lock, examples `tsc`, and browser smoke pass. The root `tsc --noEmit` reports 6
  errors, all in `packages/ai/test`, from the same stale model data. None are in
  `packages/coding-agent`.
- `./test.sh` (all packages) was not run, for the same model-data reason.

## Changelog

Not edited. Pi's `CONTRIBUTING.md` says: "Do not edit `CHANGELOG.md`. Changelog
entries are added by maintainers." Suggested entry for the maintainers, under
`packages/coding-agent/CHANGELOG.md`, `## [Unreleased]`, `### Added`:

> `input` handlers can return `expandPromptTemplates: false` with `{ action: "transform" }` to send the transformed text without skill command and prompt template expansion, as `prompt()` and `sendUserMessage()` already allow

## Before opening a PR

Pi auto-closes issues and PRs from new contributors. A maintainer must first approve
you with `lgtm` on an issue (see `CONTRIBUTING.md`). Pi has no PR template. Its issue
templates live in `.github/ISSUE_TEMPLATE/` (use `contribution.yml` or `bug.yml`).
Write the issue in your own voice, short, and say you want to implement it. Before
the PR, run `npm run check` and `./test.sh` with full network access; both must pass.

## Draft PR

Title:

```text
feat(coding-agent): let input transforms skip prompt template expansion
```

Body:

```markdown
An `input` handler that returns `{ action: "transform", text }` cannot stop pi from
expanding `/skill:name` and `/template` in the returned text. A handler that already
expanded a command gets its result expanded again when the result starts with `/`.

Example: an extension that emulates Claude Code commands turns `/my-cmd` into the
command body `/review src/index.ts`. Claude Code would send that body as is; pi
replaces it with the `review` template.

`prompt()` and `sendUserMessage()` already take `expandPromptTemplates: false`. This
adds the same optional field to the transform result (default `true`). When `false`,
`prompt()`, `steer()`, and `followUp()` send the transformed text without expansion.
In a chain of transforms, a later handler that omits the field keeps the earlier
value, since it sees text the earlier handler may have expanded.

Tests: `extensions-input-event.test.ts`, `suite/agent-session-prompt.test.ts`,
`suite/agent-session-queue.test.ts`. Docs: `docs/extensions.md`, `input` section.

Closes #<issue>
```

## How to apply once you have a fork

```sh
git clone https://github.com/<you>/pi && cd pi
git switch -c fix/input-transform-expand-opt-out
git am /path/to/pi-claude-marketplace/.planning/upstream/pi-input-transform-expand.patch
npm ci --ignore-scripts && npm run check && ./test.sh
git push -u origin fix/input-transform-expand-opt-out
```

If `main` has moved and `git am` stops on a conflict, run `git am --3way` instead, or
`git am --abort` and rebase the branch by hand. The commit author is
`acolomba <acolomba@gmail.com>`; to change it, run
`git commit --amend --reset-author --no-edit` after `git am`.
