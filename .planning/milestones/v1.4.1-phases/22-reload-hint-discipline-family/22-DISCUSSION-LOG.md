# Phase 22: Reload-hint Discipline Family - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 22-reload-hint-discipline-family
**Areas discussed:** Remove signal, Autoupdate scope, Test breadth, Lock-context confirmation

---

## Remove signal

Clean `marketplace remove` emits `plugins:[]` even when it uninstalled N plugins
(remove.ts:327-340), so a pure `plugins[].some(state-change)` gate cannot
distinguish it from an empty remove -- both render header-only today. SC#4 still
requires remove-with-uninstalls to emit `/reload`.

| Option | Description | Selected |
|--------|-------------|----------|
| Show (uninstalled) rows | Populate clean remove's plugins[] with PluginUninstalledMessage rows. Content-driven gate, matches SNM-33 wording and UAT test-19. Cost: changes clean-remove catalog byte form + catalog-uat + notify-v2 fixtures. | ✓ |
| Hidden count/flag | Keep clean remove header-only; add a non-rendered field to MarketplaceNotificationMessage that shouldEmitReloadHint reads. Preserves catalog rendering; mirrors G-21-01. Cost: new field on closed type model, caller-supplied reload-relevant fact. | |

**User's choice:** Show (uninstalled) rows
**Notes:** Reverses the deliberate V2 "clean remove = header alone" contract; that reversal is the intended catalog change. → D-22-02.

---

## Autoupdate scope

`autoupdate enabled/disabled` also change only a marketplace record (no Pi-visible
resource), the same principle behind G-MIL-01/02/06. SNM-33 names only
add/remove/update, and D-17.1-02 locked autoupdate flips to fire `/reload`.

| Option | Description | Selected |
|--------|-------------|----------|
| Extend discipline | Also gate autoupdate enabled/disabled -- no Pi-visible resource changes, so no /reload. Supersedes D-17.1-02's reload-trigger for these arms + flips the catalog autoupdate-fresh reload expectation. | ✓ |
| Keep per D-17.1-02 | Leave autoupdate flips firing /reload; keep Phase 22 strictly to SNM-33's three named tokens. | |

**User's choice:** Extend discipline
**Notes:** Folded into scope for consistency rather than deferred. Under the collapsed chokepoint rule this is automatic (autoupdate flips emit plugins:[]). → D-22-03.

---

## Test breadth

SNM-33 mandates 3 byte-equality "no trailer" regression tests (empty add, empty
remove, no-op update).

| Option | Description | Selected |
|--------|-------------|----------|
| Add positive guards | Also lock the SC#4 "still emits /reload" cases (remove that uninstalled ≥1; update with ≥1 change) against a future over-eager gate. | ✓ |
| Negative cases only | Just the 3 mandated negative cases; rely on existing cascade tests for positive paths. | |

**User's choice:** Add positive guards
**Notes:** → D-22-04.

---

## Lock-context confirmation

After the three answers, Claude surfaced two derived consequences for confirmation
(not re-asking): (1) `shouldEmitReloadHint` collapses to a plugin-row-only rule with
all marketplace-status arms deleted; (2) `add` will never emit `/reload` (it never
cascade-installs).

| Option | Description | Selected |
|--------|-------------|----------|
| Lock it in | Both consequences correct; write CONTEXT.md. | ✓ |
| Explore more | Keep marketplace-status arms as explicit gated checks instead of deleting; or reconsider add-never-reloads. | |

**User's choice:** Lock it in
**Notes:** → D-22-01 (collapsed rule), D-22-05 (add never reloads).

## Claude's Discretion

- Final form/docblock wording of the collapsed `shouldEmitReloadHint`.
- Whether to share the `PluginUninstalledMessage` mapping helper between remove.ts clean + partial paths.
- Plan/wave decomposition.

## Deferred Ideas

None -- discussion stayed within phase scope. Autoupdate was folded into scope (D-22-03), not deferred.
