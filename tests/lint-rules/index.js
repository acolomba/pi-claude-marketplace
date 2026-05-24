// tests/lint-rules/index.js
//
// Local ESLint plugin shell for the Phase 14 drift-guard rule suite.
//
// Plan 14-03 landed the shell with EMPTY `RULE_NAMES` and an EMPTY
// `rules` map. Plan 14-04 (this commit) populates both with the 16
// meta-assertion rules locked by D-14-09 / RESEARCH.md Pattern 2:
// MSG-GR-1..5 (5) + MSG-IC-1..3 (3) + MSG-SD-3 (1) + MSG-PL-1..6 (6)
// + MSG-ER-1 (1) = 16. Plan 14-05 will add the 18 full-impl rules to
// reach 34. Plan 14-06 wires the per-rule `files:` patterns in
// `eslint.config.js`; this plugin is NOT yet registered there, and
// registering an empty plugin would silently break the registry parity
// test in Plan 14-05.
//
// Order: family-then-numeric (gr → ic → sd → pl → er; numeric ascending
// within each family). Stable order keeps the registry-parity test
// output diffable across plans.
//
// D-14-07: local-plugin pattern matching how `typescript-eslint` and
// `eslint-plugin-import-x` ship rules.
// D-14-09 (LOCKED): meta-assertion vs. full-impl split.
// D-14-12: the `RULE_NAMES` export is the source the registry parity
// test (Plan 14-05) consumes -- independent of `eslint.config.js`
// parsing.

import msgEr1EmptyToken from "./msg-er-1-empty-token.js";
import msgGr1LineGrammar from "./msg-gr-1-line-grammar.js";
import msgGr2MarketplaceToken from "./msg-gr-2-marketplace-token.js";
import msgGr3PerScope from "./msg-gr-3-per-scope.js";
import msgGr4ReasonsBlock from "./msg-gr-4-reasons-block.js";
import msgGr5MarkerSlot from "./msg-gr-5-marker-slot.js";
import msgIc1FilledIcon from "./msg-ic-1-filled-icon.js";
import msgIc2OpenIcon from "./msg-ic-2-open-icon.js";
import msgIc3BlockedIcon from "./msg-ic-3-blocked-icon.js";
import msgPl1Description from "./msg-pl-1-description.js";
import msgPl2VersionSlot from "./msg-pl-2-version-slot.js";
import msgPl3VersionArrow from "./msg-pl-3-version-arrow.js";
import msgPl4UpgradableListonly from "./msg-pl-4-upgradable-listonly.js";
import msgPl5HashVersion from "./msg-pl-5-hash-version.js";
import msgPl6VersionNonSuccess from "./msg-pl-6-version-non-success.js";
import msgSd3SoftDepScope from "./msg-sd-3-soft-dep-scope.js";

export const RULE_NAMES = Object.freeze([
  "msg-gr-1-line-grammar",
  "msg-gr-2-marketplace-token",
  "msg-gr-3-per-scope",
  "msg-gr-4-reasons-block",
  "msg-gr-5-marker-slot",
  "msg-ic-1-filled-icon",
  "msg-ic-2-open-icon",
  "msg-ic-3-blocked-icon",
  "msg-sd-3-soft-dep-scope",
  "msg-pl-1-description",
  "msg-pl-2-version-slot",
  "msg-pl-3-version-arrow",
  "msg-pl-4-upgradable-listonly",
  "msg-pl-5-hash-version",
  "msg-pl-6-version-non-success",
  "msg-er-1-empty-token",
]);

export default {
  meta: {
    name: "eslint-plugin-msg-local",
    version: "1.0.0",
  },
  rules: {
    "msg-gr-1-line-grammar": msgGr1LineGrammar,
    "msg-gr-2-marketplace-token": msgGr2MarketplaceToken,
    "msg-gr-3-per-scope": msgGr3PerScope,
    "msg-gr-4-reasons-block": msgGr4ReasonsBlock,
    "msg-gr-5-marker-slot": msgGr5MarkerSlot,
    "msg-ic-1-filled-icon": msgIc1FilledIcon,
    "msg-ic-2-open-icon": msgIc2OpenIcon,
    "msg-ic-3-blocked-icon": msgIc3BlockedIcon,
    "msg-sd-3-soft-dep-scope": msgSd3SoftDepScope,
    "msg-pl-1-description": msgPl1Description,
    "msg-pl-2-version-slot": msgPl2VersionSlot,
    "msg-pl-3-version-arrow": msgPl3VersionArrow,
    "msg-pl-4-upgradable-listonly": msgPl4UpgradableListonly,
    "msg-pl-5-hash-version": msgPl5HashVersion,
    "msg-pl-6-version-non-success": msgPl6VersionNonSuccess,
    "msg-er-1-empty-token": msgEr1EmptyToken,
  },
};
