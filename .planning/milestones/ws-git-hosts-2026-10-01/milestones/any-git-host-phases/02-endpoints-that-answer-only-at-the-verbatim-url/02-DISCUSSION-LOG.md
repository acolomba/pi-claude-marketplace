# Phase 2: Endpoints that answer only at the verbatim URL - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-26
**Phase:** 02-endpoints-that-answer-only-at-the-verbatim-url
**Areas discussed:** Where the retry lives, What triggers the retry, Attempt order, Paying the 404
twice — all four dissolved by upstream research; replaced by Phase 2 shape, Inverse case,
Derivation, Roadmap fix

---

## How this discussion changed shape

The four areas originally selected all presupposed a retry. Before answering the first one, the
operator asked two questions — tabulate shorthand vs full URL, and explain what a "smart-HTTP
endpoint" is — then directed: *"research what claude code supports. our objective is parity with
claude code, notwithstanding the defect."*

That research (Claude Code 2.1.274 binary, `Tqe` parser and `xpt` add dispatcher) showed upstream
has no retry at all: it appends `.git` only for `github.com` and `gitlab.com` `owner/repo` paths and
otherwise sends the URL verbatim. All four original areas became moot, and four new ones took their
place. Recording this because the original area list is not recoverable from CONTEXT.md.

---

## Phase 2 shape

| Option | Description | Selected |
|--------|-------------|----------|
| Parity: clone verbatim, drop the retry | Derive the wire URL from `source.raw`; `source.url` stays the cache identity. No retry, no status classification. Matches upstream arm 1. Requires rewriting ROADMAP SC3 and SC4. | ✓ |
| Parity plus the gitlab arm | Same, and additionally append `.git` for `gitlab.com` `owner/repo` to match upstream arm 3. gitlab.com serves both forms, so parity for its own sake. | |
| Keep the retry as ROADMAP wrote it | Implement `.git`-first-then-verbatim anyway. No ROADMAP edit needed, but diverges from upstream and carries the whole SC2/SC3/SC4 masking-and-cleanup surface. | |

**User's choice:** Parity: clone verbatim, drop the retry.
**Notes:** Framed by the operator's own instinct before the research — *"for urls, would it not make
sense to stay verbatim?"* The research confirmed upstream already does exactly that. The gitlab arm
was declined and recorded as a deferred parity gap rather than adopted.

---

## Inverse case

| Option | Description | Selected |
|--------|-------------|----------|
| Accept it — parity, teach the suffix in the error | Verbatim in both directions. On a 404 the failure names the URL sent. MURL-09 becomes vacuous, SC3/SC4 disappear. | ✓ |
| One-shot `.git` retry, only on a suffix-less input | Clone verbatim, retry once with `.git` on a 404 when the user typed none. Keeps today's working case working — but re-introduces the whole retry surface the parity decision just deleted. | |
| Accept it, and surface the suffix at add time | Verbatim, plus `marketplace add` reports the URL it is about to clone. No retry, but a new notification row needing a closed-set catalog amendment. | |

**User's choice:** Accept it — parity, teach the suffix in the error.
**Notes:** The regression is real and was stated before the choice: a suffix-less URL against a host
serving only `/repo.git` succeeds today and will 404 after this phase. Accepted knowingly. Upstream's
own reject text carries the same lesson, so the behavior is defensible without a bespoke message.

---

## Derivation

| Option | Description | Selected |
|--------|-------------|----------|
| `networkCloneUrl(source)` beside `canonicalCloneUrl` | New sibling in `domain/clone-key.ts`, same three-kind switch. Four seam sites take a `networkUrl` string. No new type member, no GATE-01 pin. | ✓ |
| A new field on the parsed source | Compute the wire URL at parse time and store it on `UrlSource`. Needs a `contracts.json` pin or production read, revalidation in `state-io.ts` and the load-time factories, and mirroring on sibling kinds. | |
| Recompute from `raw` at each call site | No new function, no new field — four copies of the stripping logic, partly undoing the D-77-06 consolidation. | |

**User's choice:** `networkCloneUrl(source)` beside `canonicalCloneUrl`.
**Notes:** The deciding evidence was `canonicalCloneUrl`'s own docstring, which declines to fold the
suffix in because that "would rehash every `plugin-clones/` directory and cold-miss every warm
clone" — the new function is the sibling that comment anticipates. The field option was argued
against on the silent-omission class this repo has already shipped three times in one milestone.

---

## Roadmap fix

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite MURL-09 as a no-second-attempt assertion | Keep the ID, re-aim it: the URL sent is exactly the one typed modulo decoration stripping, and exactly one network attempt per operation. Provable by the call-count assertion SC3 already asked for. SC4 drops. | ✓ |
| Retire MURL-09, keep only MURL-08 | With no retry there is no blast radius to fence, so delete it. Loses the ID's traceability and leaves the coverage table one requirement light. | |
| Leave the docs, record the delta in CONTEXT.md only | Let the verifier reconcile at phase close. Least churn, but the planner reads ROADMAP success criteria as the spec and would plan the deleted retry. | |

**User's choice:** Rewrite MURL-09 as a no-second-attempt assertion.
**Notes:** The third option was called out as actively unsafe rather than merely lazy — the planner
treats ROADMAP success criteria as the spec, so an uncorrected SC3/SC4 would produce a plan for the
retry this discussion removed. The edit is a prerequisite to planning, not a cleanup after it.

---

## Follow-up question before context was written

The operator asked whether the parity requirements still address the defect the original PR
surfaced. Answered with the full trace: they do, and more directly — the 404 was the appended
`.git`, so not appending it is the fix, and the retry would merely have recovered from a request it
never needed to make. Two caveats were stated rather than buried: the fix relies on our `url` kind
being a clone source (MURL-01), which exceeds upstream, where the same URL would be fetched as a
hosted `marketplace.json`; and Phase 2 fixes the clone, not PR #153's end-to-end flow, since a
Codex-layout endpoint then fails at the manifest read (items 1 and 2, out of scope milestone-wide).

## Claude's Discretion

- Naming beyond `networkCloneUrl`.
- The decoration-stripping helper shape in `domain/source.ts` — a `stripUrlDecorations` variant, a
  parameter, or a second small function.
- Test file layout, and how the four seam signatures name the new parameter.

## Deferred Ideas

- The gitlab.com parity gap — upstream appends `.git` for `gitlab.com` `owner/repo`; we will not.
  gitlab.com serves both forms, so nothing breaks. Revisit only against evidence.
- Shorthand vs URL cache-identity asymmetry — `owner/repo.git` keeps `.git` inside `repo` and hashes
  differently from the URL form. Pre-existing D-76-01 hole.
- Codex-layout manifest lookup — PR #153 items 1 and 2, excluded milestone-wide.
- Azure DevOps `/_git/` URLs — reach the right outcome through the generic `url` arm; noted so a
  future reader does not add a special case.
