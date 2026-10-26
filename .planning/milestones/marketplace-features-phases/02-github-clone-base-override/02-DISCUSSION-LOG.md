# Phase 2: GitHub Clone-Base Override - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 02-github-clone-base-override
**Areas discussed:** Clone identity, Override changed after add, Who the variable is for, Literal gate strictness

---

## Clone identity

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch-time rewrite | git insteadOf model: identity, keys, origins stay github.com; wire URL and auth host from the variable | ✓ |
| Identity follows override | `canonicalCloneUrl` builds on the base | |
| Fixed identity, base-aware match | origins recorded under the base; origin matching maps back | |

---

## Override changed after add

| Option | Description | Selected |
|--------|-------------|----------|
| Just follow it | next fetch uses the current base; failures name the URL fetched | ✓ |
| Follow it and note the base | plus an advisory line per command | |

---

## Who the variable is for

| Option | Description | Selected |
|--------|-------------|----------|
| Mirrors and test servers | advanced setting with stated limits, marked as a divergence | ✓ |
| Testing hook only | short development note | |

| Option | Description | Selected |
|--------|-------------|----------|
| Allow a path prefix | `https://host/git` → `https://host/git/<owner>/<repo>.git` | ✓ |
| Host and port only | any non-root path refused | |

---

## Literal gate strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Every literal, per-line waivers | ESLint rule; justified disables at legitimate sites | ✓ |
| URL forms, file allowlist | only `https://github.com` URLs outside exempt files | |

## Claude's Discretion

Seam module name and API; how each fetch path receives the explicit URL; which owner tests gain override cases; which commands read the variable (network-reaching GitHub paths only).

## Deferred Ideas

None.
