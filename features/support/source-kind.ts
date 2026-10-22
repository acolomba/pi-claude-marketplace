/**
 * @fileoverview The `source kind` parameter type: the kind of source a
 * marketplace is published as.
 *
 * Only the four kinds match, so a misspelled kind is an undefined step, which
 * the feature gate rejects even in a row the default profile excludes (D-09).
 */

import { defineParameterType } from "@cucumber/cucumber";

import { parseSourceKind } from "../lib/published-marketplace.ts";

defineParameterType({
  name: "source kind",
  regexp: /dir|file|url|github/,
  transformer: parseSourceKind,
});
