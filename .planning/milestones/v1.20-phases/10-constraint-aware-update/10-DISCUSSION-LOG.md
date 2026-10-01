# Phase 10: Constraint-aware update - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-22
**Phase:** 10-constraint-aware-update
**Areas discussed:** Gate shape, Who constrains, Skip row vocabulary, Path-source fallback

---

## Gate shape

| Option | Description | Selected |
|--------|-------------|----------|
| Both stages (upstream parity) | Intersect and probe for a satisfying tag first; when none exists resolve as today, then re-check the derived `toVersion` and hold if it misses. Catches a no-tag repo and a drifted path source. | ✓ |
| Pin-first only | Pin when a satisfying tag exists, otherwise update as today and let LOAD-01 disable the dependent at the next load. | |
| Post-fetch guard only | No tag probe; skip if the resulting version misses the intersection. Never SELECTS the highest satisfying version. | |

**User's choice:** Both stages (upstream parity)
**Notes:** Upstream's own debug line marks the seam — `no <name>--v* tag satisfying <range>; falling back to HEAD + post-fetch guard`.

| Option | Description | Selected |
|--------|-------------|----------|
| Inside `preparePluginUpdate` | One gate in `update-preflight.ts`, which is already exempt from `NETWORK_FREE_TARGETS`. | |
| A new leaf module the preflight composes | Dependents lookup + intersection + probe in their own module, invoked through an injected field (the `install-clone-probe.ts` arrangement). | ✓ |
| You decide | Planner picks based on the resulting complexity score. | |

**User's choice:** A new leaf module the preflight composes
**Notes:** `preparePluginUpdate` is already near the cognitive-complexity cap that ESLint and fallow both gate at 15.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `buildScopeDeclarationDetail`, invert in the leaf | Filter its `AddressedDependency` entries down to those naming this key; no new read path. | ✓ |
| New inverse walk in `dependency-index.ts` | A third sibling returning dependents-of-key directly. | |
| You decide | Planner picks. | |

**User's choice:** Reuse `buildScopeDeclarationDetail`, invert in the leaf

| Option | Description | Selected |
|--------|-------------|----------|
| Skip that plugin's update, report the cause | Fail closed: an unestablished declaration set may hide a range. | ✓ |
| Update unconstrained, log only | Treat an unreadable dependent as declaring nothing. | |
| You decide | Planner picks. | |

**User's choice:** Skip that plugin's update, report the cause

---

## Who constrains

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — every installed record constrains (upstream parity) | Upstream reads `[...enabled, ...disabled]`; D-05-04 already says a disabled record keeps its declarations. | ✓ |
| Enabled dependents only | A disabled plugin is not loading, so it cannot break. | |

**User's choice:** Yes — every installed record constrains
**Notes:** The alternative would let an update move a dependency out of range while a dependent is briefly disabled.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — cause line names them and marks which are disabled | Upstream's remedy points at the disabled holder first. | ✓ |
| Name the dependents, no disabled marking | Simpler cause line. | |
| You decide | Planner picks the cause-line shape. | |

**User's choice:** Yes — cause line names them and marks which are disabled

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — per-scope, as the index already works | Each scope intersects only its own records' ranges (D-05-05). | ✓ |
| Both scopes constrain every update | A user-scope plugin held by a project-scope dependent. | |

**User's choice:** Yes — per-scope

| Option | Description | Selected |
|--------|-------------|----------|
| No — constraints apply whatever the provenance | The gate asks who declares the key, not how the record arrived. | ✓ |
| Only dependency-provenance records are constrained | A hand-installed plugin updates freely. | |

**User's choice:** No — constraints apply whatever the provenance

---

## Skip row vocabulary

| Option | Description | Selected |
|--------|-------------|----------|
| New token — e.g. `dependents constrain` | A distinct subject from both neighbours; a closed-set amendment across four pin surfaces. | ✓ |
| Reuse `version conflict` | No catalog amendment, but the token already covers two other subjects. | |
| Reuse `no matching version` | Fits the no-tag arm only; misattributes the post-fetch-guard arm. | |

**User's choice:** New token — e.g. `dependents constrain`
**Notes:** Exact wording left to the planner against `docs/messaging-style-guide.md`.

| Option | Description | Selected |
|--------|-------------|----------|
| One new token, cause line distinguishes | Three arms share the brace; the cause line says which and names the holders. | ✓ |
| Reuse `version conflict` for the disjoint arm, new token for the rest | Two tokens, sharper grep, more derivation sites. | |
| You decide | Planner picks. | |

**User's choice:** One new token, cause line distinguishes

| Option | Description | Selected |
|--------|-------------|----------|
| warning | The user asked for an update and did not get one. | ✓ |
| info | Nothing went wrong; quiet in bulk and background runs. | |
| warning on explicit update, info on autoupdate cascade | The SEV-01 / WR-01 precedent already in `update-row.ts`. | |

**User's choice:** warning (on every surface)
**Notes:** A deliberate departure from the SEV-01 / WR-01 split — a constraint hold persists across every future run until a declaration changes, so a background run reporting it at `info` hides the one fact that explains why the plugin never moves. To be stated explicitly where the severity is set.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `{up-to-date}`, disclose on the cause line | No new token, no catalog churn; user can still tell "nothing newer exists" from "nothing newer is allowed". | ✓ |
| Byte-identical to today — no disclosure | Smallest diff; the two cases stay indistinguishable. | |
| You decide | Planner picks. | |

**User's choice:** Keep `{up-to-date}`, disclose on the cause line

---

## Path-source fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to current copy, then post-fetch guard decides | Upstream's shape verbatim; the arm that makes stage two earn its keep. | ✓ |
| Skip immediately, no fallback | Would refuse to update a path source whose current copy is in range. | |
| Fall back and always accept the current copy | Phase 7's install arm literally; on an update it knowingly moves a plugin out of range. | |

**User's choice:** Fall back to current copy, then post-fetch guard decides

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — reuse the existing token | `{dependency current copy}` is the same fact; no catalog amendment. | ✓ |
| No — plain `(updated)` row | Loses the "this wasn't pinned" signal. | |
| You decide | Planner picks. | |

**User's choice:** Yes — reuse the existing token

| Option | Description | Selected |
|--------|-------------|----------|
| Thread the pin through the existing candidate resolution | `resolvedSha` and `toVersion` come out of the paths that already fill them; swap and record write untouched. | ✓ |
| A new pinned field on `PreparedPluginUpdate` | Explicit, but adds a field every swap arm and the disabled-refresh projection must account for. | |
| You decide | Planner picks. | |

**User's choice:** Thread the pin through the existing candidate resolution
**Notes:** A new optional field is the silent-omission class this milestone has already shipped three times.

| Option | Description | Selected |
|--------|-------------|----------|
| Share one memo across the whole bulk run | One listing per URL and per marketplace root, as the install cascade already does. | ✓ |
| Per-plugin probe, no shared memo | N listings for N constrained plugins in one marketplace. | |
| You decide | Planner picks. | |

**User's choice:** Share one memo across the whole bulk run

---

## Claude's Discretion

- Exact wording of the new reason token (two or three lowercase words, subject-first grammar).
- The leaf module's file name and exported surface shape.
- Whether the three cause-line arms share one composer or three.
- How the unconstrained regression is proven for success criterion 3.

## Deferred Ideas

- Broader rewrite of `docs/dependency-resolution.md`'s update section (only the
  parts this phase makes untrue are in scope).
- `marketplace remove` and the constraint gate — BACKLOG `PRUNE-GUARD-MR-01`
  tracks the adjacent guard question.
- Showing a held plugin's effective range on `info` / `list` — its own phase.
