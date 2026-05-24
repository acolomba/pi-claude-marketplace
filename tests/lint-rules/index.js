// tests/lint-rules/index.js
//
// Local ESLint plugin shell for the Phase 14 drift-guard rule suite.
//
// Plan 14-03 landed the shell with EMPTY `RULE_NAMES` and an EMPTY
// `rules` map. Plan 14-04 populated both with the 16 meta-assertion
// rules locked by D-14-09 / RESEARCH.md Pattern 2: MSG-GR-1..5 (5)
// + MSG-IC-1..3 (3) + MSG-SD-3 (1) + MSG-PL-1..6 (6) + MSG-ER-1 (1)
// = 16. Plan 14-05 (this commit) adds the 18 full-impl rules to
// reach 34. Plan 14-06 wires the per-rule `files:` patterns in
// `eslint.config.js`; this plugin is NOT yet registered there, and
// registering an empty plugin would silently break the registry
// parity test (which lives alongside this commit, with assertion (c)
// gated until Plan 06 wiring lands per D-14-03 "every wave green").
//
// Order: family-then-numeric, meta-assertion first (GR → IC → SD-3 →
// PL → ER) then full-impl (SR → MR → RP → CC → NC → RH → LC → SD-1
// → SD-2). Stable order keeps the registry-parity test output
// diffable across plans.
//
// D-14-07: local-plugin pattern matching how `typescript-eslint` and
// `eslint-plugin-import-x` ship rules.
// D-14-09 (LOCKED): meta-assertion vs. full-impl split.
// D-14-12: the `RULE_NAMES` export is the source the registry parity
// test (Plan 14-05) consumes -- independent of `eslint.config.js`
// parsing.

import msgCc1CauseChain from "./msg-cc-1-cause-chain.js";
import msgEr1EmptyToken from "./msg-er-1-empty-token.js";
import msgGr1LineGrammar from "./msg-gr-1-line-grammar.js";
import msgGr2MarketplaceToken from "./msg-gr-2-marketplace-token.js";
import msgGr3PerScope from "./msg-gr-3-per-scope.js";
import msgGr4ReasonsBlock from "./msg-gr-4-reasons-block.js";
import msgGr5MarkerSlot from "./msg-gr-5-marker-slot.js";
import msgIc1FilledIcon from "./msg-ic-1-filled-icon.js";
import msgIc2OpenIcon from "./msg-ic-2-open-icon.js";
import msgIc3BlockedIcon from "./msg-ic-3-blocked-icon.js";
// Full-impl rules (Plan 14-05 -- D-14-09 LOCKED). 18 entries follow
// the meta-assertion block above.
import msgLc1ConsoleWarnForm from "./msg-lc-1-console-warn-form.js";
import msgLc2EslintDiscipline from "./msg-lc-2-eslint-discipline.js";
import msgMr1ManualRecoveryAnchor from "./msg-mr-1-manual-recovery-anchor.js";
import msgMr2ManualRecoverySystem from "./msg-mr-2-manual-recovery-system.js";
import msgNc1EntityError from "./msg-nc-1-entity-error.js";
import msgNc2UsageSeparator from "./msg-nc-2-usage-separator.js";
import msgPl1Description from "./msg-pl-1-description.js";
import msgPl2VersionSlot from "./msg-pl-2-version-slot.js";
import msgPl3VersionArrow from "./msg-pl-3-version-arrow.js";
import msgPl4UpgradableListonly from "./msg-pl-4-upgradable-listonly.js";
import msgPl5HashVersion from "./msg-pl-5-hash-version.js";
import msgPl6VersionNonSuccess from "./msg-pl-6-version-non-success.js";
import msgRh1ReloadHint from "./msg-rh-1-reload-hint.js";
import msgRp1RollbackPartial from "./msg-rp-1-rollback-partial.js";
import msgSd1SoftDepReason from "./msg-sd-1-soft-dep-reason.js";
import msgSd2SoftDepPredicate from "./msg-sd-2-soft-dep-predicate.js";
import msgSd3SoftDepScope from "./msg-sd-3-soft-dep-scope.js";
import msgSr1SuccessRouting from "./msg-sr-1-success-routing.js";
import msgSr2WarningRouting from "./msg-sr-2-warning-routing.js";
import msgSr3ErrorRouting from "./msg-sr-3-error-routing.js";
import msgSr4CascadeSuccess from "./msg-sr-4-cascade-success.js";
import msgSr5CascadeWarning from "./msg-sr-5-cascade-warning.js";
import msgSr6NoCascadeError from "./msg-sr-6-no-cascade-error.js";
import msgSr7UsageErrorRouting from "./msg-sr-7-usage-error-routing.js";

export const RULE_NAMES = Object.freeze([
  // 16 meta-assertion rules (Plan 14-04).
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
  // 18 full-impl rules (Plan 14-05).
  "msg-sr-1-success-routing",
  "msg-sr-2-warning-routing",
  "msg-sr-3-error-routing",
  "msg-sr-4-cascade-success",
  "msg-sr-5-cascade-warning",
  "msg-sr-6-no-cascade-error",
  "msg-sr-7-usage-error-routing",
  "msg-mr-1-manual-recovery-anchor",
  "msg-mr-2-manual-recovery-system",
  "msg-rp-1-rollback-partial",
  "msg-cc-1-cause-chain",
  "msg-nc-1-entity-error",
  "msg-nc-2-usage-separator",
  "msg-rh-1-reload-hint",
  "msg-lc-1-console-warn-form",
  "msg-lc-2-eslint-discipline",
  "msg-sd-1-soft-dep-reason",
  "msg-sd-2-soft-dep-predicate",
]);

export default {
  meta: {
    name: "eslint-plugin-msg-local",
    version: "1.0.0",
  },
  rules: {
    // 16 meta-assertion rules (Plan 14-04).
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
    // 18 full-impl rules (Plan 14-05).
    "msg-sr-1-success-routing": msgSr1SuccessRouting,
    "msg-sr-2-warning-routing": msgSr2WarningRouting,
    "msg-sr-3-error-routing": msgSr3ErrorRouting,
    "msg-sr-4-cascade-success": msgSr4CascadeSuccess,
    "msg-sr-5-cascade-warning": msgSr5CascadeWarning,
    "msg-sr-6-no-cascade-error": msgSr6NoCascadeError,
    "msg-sr-7-usage-error-routing": msgSr7UsageErrorRouting,
    "msg-mr-1-manual-recovery-anchor": msgMr1ManualRecoveryAnchor,
    "msg-mr-2-manual-recovery-system": msgMr2ManualRecoverySystem,
    "msg-rp-1-rollback-partial": msgRp1RollbackPartial,
    "msg-cc-1-cause-chain": msgCc1CauseChain,
    "msg-nc-1-entity-error": msgNc1EntityError,
    "msg-nc-2-usage-separator": msgNc2UsageSeparator,
    "msg-rh-1-reload-hint": msgRh1ReloadHint,
    "msg-lc-1-console-warn-form": msgLc1ConsoleWarnForm,
    "msg-lc-2-eslint-discipline": msgLc2EslintDiscipline,
    "msg-sd-1-soft-dep-reason": msgSd1SoftDepReason,
    "msg-sd-2-soft-dep-predicate": msgSd2SoftDepPredicate,
  },
};
