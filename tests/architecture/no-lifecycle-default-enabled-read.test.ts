import test from "node:test";

import { assertNoForbiddenSurface } from "../helpers/source-scan.ts";

/**
 * DFEN-07 architectural surface guard (D-103-08, D-103-09).
 *
 * Forbidden surface, by file:
 *   - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
 *     MUST NOT reference `defaultEnabled` or `applyDefaultEnabled`.
 *   - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
 *     MUST NOT reference `defaultEnabled` or `applyDefaultEnabled`.
 *
 * Why these two targets: a plugin release that changes the declared field must
 * not move a user who already installed. `defaultEnabled` is third-party
 * content -- a lifecycle verb that re-consulted it would turn the field into a
 * remote switch over code that is already on disk. Both verbs re-materialize
 * artifacts and both hold a resolved plugin object that CARRIES the field, so
 * the guarantee is precisely that neither reads it off. That guarantee is
 * negative: nothing observable changes until the read already exists, which is
 * why it is defended at the source rather than only in behavior.
 *
 * Exempt files (do NOT add):
 *   - orchestrators/plugin/install.ts reads the field legitimately. That read
 *     IS DFEN-04, gated by the caller opt-in and by the DFEN-05 precedence rule
 *     (an existing `enabled` value wins and is never overwritten).
 *   - orchestrators/plugin/enable-disable.ts re-materializes from the RECORD on
 *     its enable branch, never from a manifest declaration, so it never names
 *     the field either -- but it is not gated here because its subject is the
 *     user's own explicit choice, not a third-party declaration.
 *
 * The resolver carve-out:
 *   This gate forbids NAMING the field, not obtaining the object that carries
 *   it. Both targets call `resolveStrict` and must keep doing so; no pattern
 *   here mentions that call, and adding one would break both verbs for a
 *   guarantee it does not express. Neither pattern matches the resolver's own
 *   `resolveDefaultEnabled` accessor either.
 *
 * The two patterns are independent, not redundant:
 *   The short identifier is a strict suffix of the long one, and both
 *   characters at the join are word characters, so there is no word boundary
 *   between them -- a `\b`-anchored match on the short name does NOT fire
 *   inside the long one. Removing either pattern leaves a real hole.
 *
 * No target is excused as missing (WR-06). Both files exist; excusing either
 * would let a rename silently uncover the guarantee, which is the same failure
 * mode as inspecting nothing at all.
 *
 * Comment-strip rationale (mandatory):
 *   The shared helper strips comments before matching, so a source header that
 *   explains the absence in prose is legal. Today a raw search over both files
 *   finds neither token at all, so an unstripped gate would pass -- right up
 *   until someone documents the rule in the very file it governs, at which
 *   point the gate would fail on its own subject's prose. Delegate to the
 *   helper; never hand-roll a raw read plus a match (D-98-09, D-98-10).
 */
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts",
];

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "defaultEnabled reference", pattern: /\bdefaultEnabled\b/ },
  { name: "applyDefaultEnabled reference", pattern: /\bapplyDefaultEnabled\b/ },
];

test("DFEN-07 (D-103-08, D-103-09): the lifecycle verbs never name the declared-enablement field", async () => {
  await assertNoForbiddenSurface(
    FORBIDDEN_TARGETS,
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `DFEN-07 violation: a re-materializing lifecycle verb names the declared-enablement field:\n  ${offenders.join("\n  ")}\n  (Enablement for an already-installed plugin comes from the RECORD. The manifest declaration is an install-time input only, read by the install verb alone; re-applying it would let a plugin release flip a user's existing choice.)`,
  );
});
