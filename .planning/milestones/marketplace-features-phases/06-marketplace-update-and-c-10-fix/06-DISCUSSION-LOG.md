# Phase 6: Marketplace Update and C-10 Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-18
**Phase:** 6-marketplace-update-and-c-10-fix
**Areas discussed:** C-10 file identity, Change detection, Autoupdate cascade, Bare update sequencing

---

## C-10 file identity

### User-visible source path

| Option | Description | Selected |
|--------|-------------|----------|
| External files only | Show the exact manifest only when it is outside `.claude-plugin/`; preserve the root display for a conventional file | |
| Containing directory | Show one directory-shaped source and hide the exact manifest file | |
| Every file source | Show the exact manifest path for every file-based marketplace | ✓ |

**User's choice:** Match Claude Code's file-versus-directory distinction and show the exact file for every file source.
**Notes:** The user first clarified that this question concerned user-visible `info` output, then asked what the manifest contains and what Claude Code does. Official documentation showed that Claude Code reads a file source in place and reports its path, so the initial external-file-only recommendation was corrected.

### Authoritative update location

| Option | Description | Selected |
|--------|-------------|----------|
| Resolved manifest path | Persist and reread the exact resolved file | ✓ |
| Re-resolve input | Reinterpret the user's original path on every update | |
| Managed copy | Copy into a conventional `.claude-plugin/marketplace.json` layout | |

**User's choice:** Store the resolved manifest file path.
**Notes:** After reviewing the tradeoffs, the user chose the smallest upstream-compatible model.

### Missing source behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fail cleanly | Report `source missing`, keep the registration, and keep no copy | ✓ |
| Conventional fallback | Try `<marketplace-root>/.claude-plugin/marketplace.json` | |
| Rediscovery | Search nearby directories for another manifest | |

**User's choice:** Reread the marketplace source and keep no copies.
**Notes:** The user clarified that moving or deleting the external file is a source change between operations, not Pi-managed internal-state corruption.

### Regression coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Behavioral plus paired tests | Real-Pi scenario and normal paired unit coverage | ✓ |
| Behavioral only | Prove only the public scenario | |
| Unit only | Prove only the focused implementation branch | |

**User's choice:** Behavioral test plus the normal 100% coverage paired tests.
**Notes:** None.

---

## Change detection

### Equality model

| Option | Description | Selected |
|--------|-------------|----------|
| Structural JSON | Ignore whitespace and object-key order | ✓ |
| Serialized parsed JSON | Ignore whitespace but count object-key order | |
| Raw bytes | Count formatting changes | |

**User's choice:** Structural parsed-JSON equality.
**Notes:** Claude Code does not expose an equivalent `updated` versus `up-to-date` result, so this is a Pi-specific contract.

### Unknown fields

| Option | Description | Selected |
|--------|-------------|----------|
| Include | Tolerated unknown-field changes report `updated` | ✓ |
| Ignore | Compare only recognized schema fields | |
| Reject | Make every unknown field invalid | |

**User's choice:** Include tolerated unknown fields.
**Notes:** None.

### Array order

| Option | Description | Selected |
|--------|-------------|----------|
| Significant | Reordered arrays report `updated` | ✓ |
| Ignore plugin order | Treat only the top-level `plugins` array as unordered | |
| Ignore all array order | Treat every array as a set | |

**User's choice:** Preserve array-order significance.
**Notes:** Plugin order can affect user-visible results.

### Invalid refreshed manifest

| Option | Description | Selected |
|--------|-------------|----------|
| Fail cleanly | Keep the registration and make no plugin changes | ✓ |
| Remove registration | Delete the marketplace because its source is invalid | |
| Partial recovery | Continue with any fields that can be recovered | |

**User's choice:** Fail cleanly and retry from the source on a later update.
**Notes:** None.

---

## Autoupdate cascade

### Plugin order

| Option | Description | Selected |
|--------|-------------|----------|
| Installed-record order | Preserve installed lifecycle order | ✓ |
| Manifest order | Follow the refreshed catalog | |
| Alphabetical | Sort plugin names | |

**User's choice:** Installed-plugin record order.
**Notes:** Newly offered plugins remain uninstalled.

### Per-plugin failure

| Option | Description | Selected |
|--------|-------------|----------|
| Continue | Attempt and report every remaining installed plugin | ✓ |
| Stop | Stop after the first failure | |
| Roll back | Undo earlier successful plugin updates | |

**User's choice:** Continue and report every result.
**Notes:** None.

### Dropped plugin

| Option | Description | Selected |
|--------|-------------|----------|
| Leave installed | Emit a skipped `not in manifest` warning | ✓ |
| Uninstall | Remove it automatically | |
| Disable | Keep it but turn it off | |

**User's choice:** Leave the plugin installed and enabled, with a warning row.
**Notes:** None.

### Primary marketplace result

| Option | Description | Selected |
|--------|-------------|----------|
| Remain updated | Keep independent plugin failure rows | ✓ |
| Become failed | Change the marketplace result when a plugin fails | |
| Aggregate failure | Replace detailed rows with one failure | |

**User's choice:** Keep the marketplace `updated`; report plugin failures independently.
**Notes:** None.

---

## Bare update sequencing

### Scope order

| Option | Description | Selected |
|--------|-------------|----------|
| Project then user | Preserve current scope precedence | ✓ |
| User then project | Reverse scope precedence | |
| Global name sort | Merge scopes and sort all names | |

**User's choice:** Project marketplaces before user marketplaces.
**Notes:** None.

### Within-scope order

| Option | Description | Selected |
|--------|-------------|----------|
| Saved-record order | Preserve insertion order | ✓ |
| Alphabetical | Sort marketplace names | |
| Newest first | Reverse lifecycle order | |

**User's choice:** Saved-record insertion order.
**Notes:** None.

### Marketplace failure

| Option | Description | Selected |
|--------|-------------|----------|
| Continue all | Report every remaining marketplace | ✓ |
| Stop immediately | End after the first failure | |
| Stop before next scope | Finish only the current scope | |

**User's choice:** Continue through all remaining marketplaces.
**Notes:** None.

### MCP notice placement

| Option | Description | Selected |
|--------|-------------|----------|
| Adjacent | Emit immediately after the producing marketplace cascade | ✓ |
| Trailing group | Collect every notice at the end | |
| Folded | Embed the notice in the marketplace result | |

**User's choice:** Keep notices adjacent to their producing cascade.
**Notes:** Targeted unit tests measured the current project-first marketplace order and immediate post-cascade notice order on 2026-10-18.

---

## Agent's Discretion

- Structural-comparison implementation details.
- Exact Gherkin wording, fixture names, helper boundaries, focused paired-test cases, and plan split.

## Deferred Ideas

- Activate remote `@url` and `@github` behavioral rows in Phases 9 and 10.
- Keep `.planning/todos/pending/2026-10-13-cucumber-rules-trial.md` §3 out of scope because it concerns another repository.
