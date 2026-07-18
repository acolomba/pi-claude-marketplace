# Phase 76: Marketplace git-URL sources - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 76-marketplace-git-url-sources
**Areas discussed:** git-subdir input syntax, URL acceptance rules, Private-repo failure UX, Source display in list/info

---

## git-subdir input syntax

Before the question, the user asked how Claude Code handles subdirectory
marketplaces; a claude-code-guide research agent checked the official docs
(code.claude.com/docs/en/plugin-marketplaces.md, plugins-reference.md) and
found upstream has NO subdirectory-marketplace concept: no CLI syntax, no
`extraKnownMarketplaces` shape, marketplace.json required at repo root;
`git-subdir` exists only as a plugin-source shape.

| Option | Description | Selected |
|--------|-------------|----------|
| --path flag (Recommended) | `marketplace add <url> --path sub/dir` as a deliberate Pi extension | |
| In-string // delimiter | go-getter style `<url>//sub/dir` | |
| Config-only | git-subdir marketplaces only via claude-plugins.json object form | |
| Drop MURL-02 | Align strictly with upstream: no marketplace-level git-subdir anywhere | ✓ |

**User's choice:** Drop MURL-02
**Notes:** Requirements change — MURL-02 and ROADMAP success criterion 2
removed; monorepo subdirectories remain a plugin-source concept (Phase 77).
Side effect: config schema `source: Type.String()` stays sufficient.

---

## URL acceptance rules

| Option | Description | Selected |
|--------|-------------|----------|
| https only (Recommended) | Any host; http/ssh/git@ reject with clean per-scheme reasons | ✓ |
| https + http | Also accept plain http for LAN git servers | |

**User's choice:** https only

| Option | Description | Selected |
|--------|-------------|----------|
| Always github kind (Recommended) | github.com URLs normalize to `github` kind in every entry form | ✓ |
| Preserve declared kind | Object-form url declarations stay url kind even for github.com | |

**User's choice:** Always github kind

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, #ref parity (Recommended) | `#<ref>` fragment parses into UrlSource.ref, singleBranch clone | ✓ |
| No refs in Phase 76 | Default branch only | |

**User's choice:** Yes, #ref parity

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Phase 76 | `owner/repo@ref` parses to github kind with ref (upstream parity); SP-2 reject retired | ✓ |
| Defer to backlog | Keep SP-2 reject + hint | |

**User's choice:** Fold into Phase 76
**Notes:** User first asked what Claude Code does; upstream documents `@ref`
on GitHub shorthand and `#ref` on git URLs, each scoped to its input form.

---

## Private-repo failure UX

| Option | Description | Selected |
|--------|-------------|----------|
| New reason token (Recommended) | `authentication required` REASONS member; truthful attribution; Phase 79 PROV-04 reuses it | ✓ |
| Unclassified fall-through | Generic failed row + raw HTTP cause chain | |
| Reuse network unreachable | No catalog change but untruthful | |

**User's choice:** New reason token

| Option | Description | Selected |
|--------|-------------|----------|
| No — public only (Recommended) | No auth bundle on URL clones; 401 fails clean; all non-GitHub auth lands in Phase 79 | ✓ |
| Yes — fill-only auth | Consult OS keychain for stored credentials without a flow | |

**User's choice:** No — public only

---

## Source display in list/info

| Option | Description | Selected |
|--------|-------------|----------|
| url: <url>[#ref] (Recommended) | Kind-labeled attribute line matching github:/path: convention | ✓ |
| git: <url>[#ref] | Label by mechanism instead of kind | |

**User's choice:** url: <url>[#ref]

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — all git-backed (Recommended) | last_updated: gate widens to github + url kinds | ✓ |
| Keep github-only | url sources omit the line | |

**User's choice:** Yes — all git-backed
**Notes:** `marketplace list` needs no change (headers carry no source line).

---

## Claude's Discretion

- `.git`-suffix identity in `samePlannedSource`/dedupe comparisons
- No pre-clone URL validation beyond scheme/shape parsing (clone failure is the signal)
- HttpError-statusCode → `authentication required` detection mechanics in `classifyAddError`
- url-arm ref-aware comparison parity in `samePlannedSource`

## Deferred Ideas

None — the one candidate (`owner/repo@ref` shorthand parity) was folded into
this phase rather than deferred.
