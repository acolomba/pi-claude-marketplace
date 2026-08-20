---
description: Review upstream releases (pi, pi-subagents, pi-mcp-adapter) over a given time frame and assess each changelog entry's impact on this project — bugs worth picking up, features that unblock work, and contract drift that could break us silently.
argument-hint: "[time frame] e.g. 1w (default), 30d, since 2026-07-01, 2026-07-01..2026-08-01"
allowed-tools: Bash, Read, Grep, Glob, WebFetch, Task, SlashCommand
---

# Upstream release review

Read what our three upstreams shipped in a given window and work out, entry by entry, what it means for `pi-claude-marketplace`. This is **read-only research** — it produces a report and a set of recommended follow-ups, and changes nothing on disk.

The three upstreams:

- `earendil-works/pi` — npm `@earendil-works/pi-coding-agent`
- `nicobailon/pi-subagents` — npm `pi-subagents`
- `nicobailon/pi-mcp-adapter` — npm `pi-mcp-adapter`

## Phase 0 — Resolve the time frame

`$ARGUMENTS` is an optional time frame. Default to the **past 7 days** when it is empty. Accept, and normalize to an explicit `[start, end]` date pair:

- durations — `1w`, `2w`, `7d`, `30d`, `3m`
- open-ended — `since 2026-07-01`, `since v0.12.0` (the date that tag was published in this repo)
- closed ranges — `2026-07-01..2026-08-01`
- informal — `last month`, `since the last milestone` (use `.planning/STATE.md`'s `last_activity`)

Compute the boundary dates with `date` (this is macOS, so BSD `date -v-7d +%F`; fall back to GNU `date -d` if that fails), and **state the resolved window in the first line of your report**. Everything downstream filters on it.

Widen the cap on how many releases you fetch to match the window — a 3-month window needs a larger `--limit` than a week.

## Phase 1 — Gather the releases

For each repo:

```bash
gh release list --repo <owner/repo> --limit <N> \
  --json tagName,name,publishedAt,isPrerelease,isDraft
```

Filter by `publishedAt` inside the window — do not trust `--limit` ordering alone — then pull the body of each in-window release with `gh release view <tag> --repo <owner/repo> --json body`.

GitHub releases are not the whole story:

- A repo may tag without cutting a release — check `gh api repos/<owner/repo>/tags` and the repo's `CHANGELOG.md`.
- npm may lead or lag the tags — cross-check `npm view <pkg> versions --json` and `npm view <pkg> time --json`.
- Include prereleases; exclude drafts.

If a repo published nothing in the window, say so in one line and move on.

Then establish **what we are actually on today**, because impact is relative to that, not to latest:

- `@earendil-works/pi-coding-agent` — peer floor and dev pin in `package.json`; installed version in `node_modules`
- `pi-subagents` — optional peer floor in `package.json` (it is normally **not installed** locally)
- `pi-mcp-adapter` — **not a dependency at all**; there is no version to read

## Phase 2 — Know the three relationships

These upstreams reach us in three different ways. Assessing them uniformly is the main way this review goes wrong.

1. **pi (`@earendil-works/pi-coding-agent`) — our host API.** We consume it through `extensions/pi-claude-marketplace/platform/pi-api.ts`. What matters: new or changed extension events, `ctx.ui.notify` behavior, the hook event surface, session lifecycle, `resources_discover` / `session_start` semantics, `process.env` handling. Raising the peer floor is a real decision with a user cost (NFR-11) — flag it as a recommendation, never as a foregone conclusion.

2. **pi-subagents — optional soft dependency.** Probed at runtime through `shared/concerns/soft-dep.ts`; absence degrades rather than fails. We **write** its `agents-index.json`. Changes to that index schema, to agent frontmatter handling, or to its own floors land on `bridges/agents/*` and `persistence/agents-index-{io,schema}.ts`.

3. **pi-mcp-adapter — not a dependency; the downstream consumer of files we write.** This is the one that can break us with zero signal in `package.json`, so give it the most scrutiny per line of changelog. Check specifically: the four-slot config contract (`bridges/mcp/collision-slots.ts`, MC-4 / RN-5), stdio server `env` precedence, and the `resolveEnv` inheritance behavior recorded as a verified divergence in `docs/env-vars.md`.

Consider fanning out one subagent per upstream for Phases 1-3 — each has to read real upstream diffs, which is expensive — then synthesize the three reports here.

## Phase 3 — Ground each entry in our own files

Read what a given finding actually needs; do not bulk-read all of this.

Intent and open threads:

- `.planning/BACKLOG.md` — deferred ideas, including items explicitly blocked on upstream (e.g. UAT-02, where `/reload` erases extension notifications). An upstream release is exactly what closes these.
- `.planning/WINDOWS.md` — the open broken-windows ledger; check whether an upstream change lets one be fixed or finally verified.
- `.planning/PROJECT.md` — §Constraints, §Key Decisions (`D-NN`), §Requirements (Active and **Out of Scope**). Anything scoped out *because upstream could not do it yet* is a prime candidate to reopen.
- `.planning/STATE.md` — current position and the deferred-items table.
- `.planning/ROADMAP.md`, `.planning/MILESTONES.md` — so a "new capability" finding is not something we already shipped.
- `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md` — recorded assumptions about upstream behavior that a release can quietly stale.
- `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/CONCERNS.md`.

Contract docs — these encode version-dependent upstream facts and are the likeliest things to need correction:

- `docs/hooks-compatibility.md` — event list, matcher syntax, `if` field, handler fields, env table, install-time disposition. A new Pi event is the highest-leverage upstream change this project can receive; cross-check against `BUCKET_A_EVENTS` in `extensions/pi-claude-marketplace/bridges/hooks/`.
- `docs/env-vars.md` — §Divergences, especially the pi-mcp-adapter `resolveEnv` finding.
- `docs/output-catalog.md` — user-visible strings and degradation reason tokens.
- `docs/research/claude-hooks-vs-pi-events.md`, `docs/research/claude-hook-config-syntax.md`.

Code anchors: `platform/pi-api.ts`, `bridges/hooks/*`, `bridges/mcp/collision-slots.ts`, `bridges/agents/*`, `persistence/agents-index-schema.ts`, `shared/concerns/soft-dep.ts`, `package.json`, `CHANGELOG.md`.

## Phase 4 — Classify every entry

One row per changelog entry, in exactly one bucket:

- **NO-IMPACT** — one line of why, then drop it.
- **PICK-UP** — fixes a bug that affects us, or one we currently work around. Name the workaround and the file that would shrink.
- **FLOOR-BUMP** — we should raise a peer floor or dev pin to get it. State what breaks for users still on the old version.
- **ENABLES** — a new capability that lets us implement or improve a feature, or delete a workaround. Map it to a requirement ID or a backlog item.
- **BREAKING-RISK** — upstream changed a contract we depend on or write into. The pi-mcp-adapter danger zone. Highest priority; lead the report with these.
- **UNBLOCKS-BACKLOG** — closes or advances a `BACKLOG.md` or `WINDOWS.md` item.

A long window will produce a lot of NO-IMPACT rows. Collapse them into a single counted line per upstream rather than enumerating each.

## Phase 5 — Evidence bar

For every non-NO-IMPACT finding, give:

- the upstream release tag and the entry text, quoted
- the exact file in **this** repo that would change, as `path:line`
- the spec ID it touches (`D-NN`, `NFR-N`, or a requirement ID such as `HOOK-*`, `MENV-*`, `SENV-*`, `ATTR-*`) where one exists
- whether the action is a doc fix, a code change, a version bump, or only a backlog entry
- your confidence, and what would confirm it

Do not take a changelog line at face value when the impact claim is not obvious. Read the upstream commit or source. Changelog prose routinely understates a contract change and overstates a feature.

## Phase 6 — Report

Produce, in the conversation:

1. The resolved window, and one line per upstream on what it shipped in it.
2. A summary table — upstream | release | entry | bucket | our file | action.
3. Detail sections for every BREAKING-RISK, ENABLES, and UNBLOCKS-BACKLOG finding.
4. Recommended next actions, split into: do now / file to backlog / fold into the next milestone.

**Write no files.** Per `CLAUDE.md`, repo edits route through a GSD entry point — so name the one to use rather than editing directly:

- `/gsd-capture` — a new backlog item or seed
- `/gsd-quick` — a doc correction (e.g. a stale row in `docs/hooks-compatibility.md`)
- `/gsd-new-milestone` — when the findings add up to scoped work

If a finding implies a version bump, note that it also touches `sonar-project.properties`, `EXTENSION_VERSION`, `package-lock.json`, and `CHANGELOG.md`, and that `npm run check` must be green — not just the pre-commit hooks.
