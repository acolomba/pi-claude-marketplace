/**
 * tests/architecture/notify-closed-set-locks.test.ts -- closed-set length
 * tripwires for the notification vocabulary (OUT-08 / SNM-02).
 *
 * The `REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, and `MARKETPLACE_STATUSES`
 * tuples are the closed sets the renderer, the catalog, and the per-command
 * `satisfies CommandContext` checks are written against. The compile-time proofs
 * (`notify-reasons.ts::_ReasonsCoverageProof`, the `assertNever` renderer tails)
 * catch a member that is REMOVED or RENAMED, but an ADDITIVE drift -- a new
 * literal appended to a set and given a home everywhere the type system looks --
 * is silently absorbed.
 *
 * These exact-length assertions are the deliberate-bump tripwire for that case:
 * appending a closed-set member forces a conscious update here, which is the
 * prompt to also add its catalog fixture / output-catalog.md row / renderer arm.
 * Bump the expected count in the SAME change that grows the set.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  REASONS,
  STATUS_TOKENS,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

test("OUT-08: REASONS is the closed 58-entry reason set", () => {
  // D-76-08: +1 for the `authentication required` failure-class member (32 -> 33).
  // PURL-06: +1 for the `dangling reference` failure-class member (33 -> 34).
  // MCPR-03 / D-02: +1 for the malformed mcp failure-class member (34 -> 35).
  // CLASS-01 / D-86-01: +2 for the per-kind `malformed skill` / `malformed
  // command` failure-class members (35 -> 37).
  // D-90-05: +1 for the `unsupported component` member -- the truthful marker
  // for a dropped non-carve-out component kind (37 -> 38).
  // OUT-01 / DFEN-04: +1 for the `installs disabled` member -- the marker for an
  // install that landed disabled on the plugin's own declaration (38 -> 39).
  // CMP-4 / SCOPE-01: +1 for `marketplace not added to user scope` -- the SECOND
  // structural marketplace-absent marker, replacing `marketplace not added` on the row when
  // the container was found in the scope the command did not target (39 -> 40),
  // +1 for its project-target sibling `marketplace not added to project scope`
  // (40 -> 41).
  // SCOPE-01 / D-01: +2 for the `marketplace in user scope` /
  // `marketplace in project scope` CONTENT pair -- the cross-scope qualifier an
  // absent-target lifecycle row joins to `not installed` so the
  // container-is-one-scope-over miss stops rendering byte-identically to the
  // container-is-here miss (41 -> 43).
  // WDET-04 / D-106-04: +1 for the dedicated final `workflows` member
  // (43 -> 44).
  // DATA-01 / WR-06: +1 for `data kept`, uninstall's data-disposition marker --
  // the token that separates the preserving branch from the destructive default
  // (44 -> 45).
  // RESV-02..06: +7 for the dependency-cascade vocabulary -- `no matching
  // version`, `version conflict`, `constraint too complex`, `invalid version
  // constraint`, `dependency marketplace not added`, `dependency cycle` and
  // `dependency failed`. They are what let one cascade row name WHICH
  // dependency failed and WHY, instead of the requesting plugin alone
  // (45 -> 52).
  // RESV-05: +1 for `dependency disabled` -- the marker that lifts a skipped
  // dependency off the benign-skip default when its record is disabled and it
  // therefore materialized nothing for the requesting plugin to install
  // against (52 -> 53).
  // D-04-07: +1 for `dependency promoted` -- install's marker for a recorded
  // dependency the user then asked for by name. The record changes hands and
  // nothing is materialized; `already installed` alone is the refusal's brace
  // and cannot report a state change (53 -> 54).
  // D-05-14 / D-05-15: +1 for `dependents remain` -- uninstall's refusal marker
  // for a plugin another installed plugin in the scope still declares. Nothing
  // is removed, the dependents ride the cause line, and the token is an error
  // rather than a benign skip (54 -> 55).
  // D-05-11 / PRUNE-04: +1 for `dependency pruned` -- the marker `uninstall
  // --prune` stamps on each orphaned dependency record it removed after the
  // named plugin. An ordinary `uninstalled` row whose brace says why a plugin
  // the user did not name went (55 -> 56).
  // LOAD-01: +1 for `dependency unsatisfied` -- the load-time check's marker
  // for a recorded plugin it disabled because a dependency it declares is not
  // satisfied in the scope. It names the CONDITION; the remedy naming both
  // parties rides the row's cause line, which no closed-set token could carry
  // (56 -> 57).
  // LOAD-01: +1 for `dependency version unsatisfied` -- the same check's marker
  // for a dependency that IS recorded and enabled at a version outside the
  // declared range. It mirrors upstream's second error code, and the split is
  // what keeps the two remedies apart: one says install or enable the missing
  // thing, the other says move an existing thing's version (57 -> 58).
  assert.equal(REASONS.length, 58);
});

test("SNM-02: STATUS_TOKENS is the closed 24-entry token set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for the derived `partially-installed` /
  // `partially-upgradable` realized tokens. `will partially install` is a render
  // modifier on `will install`, NOT a token, so the set grows by exactly 2.
  // USTAT-02 / D-64-01: +1 for the de-collapsed not-installed `partially-available`
  // render token (22 -> 23).
  // RSTA-01 / D-80-06: +1 for the not-installed git-source `remote` token (23 -> 24).
  assert.equal(STATUS_TOKENS.length, 24);
});

test("SNM-02: PLUGIN_STATUSES is the closed 19-entry plugin-status set", () => {
  // FSTAT-02 / FSTAT-04 / D-66-05: +2 for `partially-installed` / `partially-upgradable`.
  // USTAT-02 / D-64-01: +1 for `partially-available` (17 -> 18). Both tuples gain the
  // member; `PLUGIN_STATUSES` MUST because `PluginInfoRowBase.status` derives via
  // `Extract<PluginStatus, "partially-available">`.
  // RSTA-01 / D-80-06: +1 for `remote` (18 -> 19) -- likewise required in
  // `PLUGIN_STATUSES` because the info surface renders `(remote)` via
  // `Extract<PluginStatus, "remote">`.
  assert.equal(PLUGIN_STATUSES.length, 19);
});

test("SNM-02: MARKETPLACE_STATUSES is the closed 7-entry marketplace-status set", () => {
  assert.equal(MARKETPLACE_STATUSES.length, 7);
});
