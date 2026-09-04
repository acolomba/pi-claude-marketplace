import assert from "node:assert/strict";
import test from "node:test";

import {
  extractEnabledPluginRefs,
  parseEnabledPluginRef,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/refs.ts";

test("parseEnabledPluginRef accepts one separator and preserves the verbatim raw input", () => {
  // arrange
  const raw = "frontend-design@claude-plugins-official";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: true,
    ref: {
      marketplace: "claude-plugins-official",
      plugin: "frontend-design",
      raw: "frontend-design@claude-plugins-official",
    },
  });
});

test("parseEnabledPluginRef trims the ref parts without changing the raw input", () => {
  // arrange
  const raw = "  frontend-design  @  claude-plugins-official  ";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: true,
    ref: {
      marketplace: "claude-plugins-official",
      plugin: "frontend-design",
      raw: "  frontend-design  @  claude-plugins-official  ",
    },
  });
});

test("parseEnabledPluginRef rejects an empty input with the separator diagnostic", () => {
  // arrange
  const raw = "";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected exactly one @ separator in plugin@marketplace ref.",
  });
});

test("parseEnabledPluginRef rejects a ref with no separator", () => {
  // arrange
  const raw = "frontend-design";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected exactly one @ separator in plugin@marketplace ref.",
  });
});

test("parseEnabledPluginRef rejects a ref with multiple separators", () => {
  // arrange
  const raw = "frontend-design@marketplace@extra";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected exactly one @ separator in plugin@marketplace ref.",
  });
});

test("parseEnabledPluginRef rejects an empty plugin side", () => {
  // arrange
  const raw = "@claude-plugins-official";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected non-empty plugin and marketplace in plugin@marketplace ref.",
  });
});

test("parseEnabledPluginRef rejects a whitespace-only plugin side", () => {
  // arrange
  const raw = "   @claude-plugins-official";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected non-empty plugin and marketplace in plugin@marketplace ref.",
  });
});

test("parseEnabledPluginRef rejects an empty marketplace side", () => {
  // arrange
  const raw = "frontend-design@";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected non-empty plugin and marketplace in plugin@marketplace ref.",
  });
});

test("parseEnabledPluginRef rejects a whitespace-only marketplace side", () => {
  // arrange
  const raw = "frontend-design@   ";

  // act
  const result = parseEnabledPluginRef(raw);

  // assert
  assert.deepEqual(result, {
    ok: false,
    reason: "Expected non-empty plugin and marketplace in plugin@marketplace ref.",
  });
});

test("extractEnabledPluginRefs selects exact true values and skips exact false values", () => {
  // arrange
  const settings = {
    enabledPlugins: {
      "alpha@first-marketplace": true,
      "disabled-malformed-ref": false,
      "omega@last-marketplace": true,
    },
    extraKnownMarketplaces: {},
  };

  // act
  const result = extractEnabledPluginRefs("user", settings);

  // assert
  assert.deepEqual(result, {
    diagnostics: [],
    refs: [
      {
        marketplace: "first-marketplace",
        plugin: "alpha",
        raw: "alpha@first-marketplace",
      },
      {
        marketplace: "last-marketplace",
        plugin: "omega",
        raw: "omega@last-marketplace",
      },
    ],
  });
});

test("extractEnabledPluginRefs reports nonboolean project values in exact input order", () => {
  // arrange
  const settings = {
    enabledPlugins: {
      "string-value@marketplace": "true",
      "number-value@marketplace": 1,
      "null-value@marketplace": null,
      "object-value@marketplace": {},
      "array-value@marketplace": [],
    },
    extraKnownMarketplaces: {},
  };

  // act
  const result = extractEnabledPluginRefs("project", settings);

  // assert
  assert.deepEqual(result, {
    diagnostics: [
      {
        code: "non-boolean-enabled-plugin",
        message:
          'Skipping enabled plugin ref "string-value@marketplace" because its value is not boolean true or false.',
        ref: "string-value@marketplace",
        scope: "project",
        severity: "warning",
      },
      {
        code: "non-boolean-enabled-plugin",
        message:
          'Skipping enabled plugin ref "number-value@marketplace" because its value is not boolean true or false.',
        ref: "number-value@marketplace",
        scope: "project",
        severity: "warning",
      },
      {
        code: "non-boolean-enabled-plugin",
        message:
          'Skipping enabled plugin ref "null-value@marketplace" because its value is not boolean true or false.',
        ref: "null-value@marketplace",
        scope: "project",
        severity: "warning",
      },
      {
        code: "non-boolean-enabled-plugin",
        message:
          'Skipping enabled plugin ref "object-value@marketplace" because its value is not boolean true or false.',
        ref: "object-value@marketplace",
        scope: "project",
        severity: "warning",
      },
      {
        code: "non-boolean-enabled-plugin",
        message:
          'Skipping enabled plugin ref "array-value@marketplace" because its value is not boolean true or false.',
        ref: "array-value@marketplace",
        scope: "project",
        severity: "warning",
      },
    ],
    refs: [],
  });
});

test("extractEnabledPluginRefs preserves enabled-ref and diagnostic order across mixed user settings", () => {
  // arrange
  const settings = {
    enabledPlugins: {
      "first@marketplace": true,
      malformed: true,
      "disabled@marketplace": false,
      "not-boolean@marketplace": "false",
      "  second  @  another-marketplace  ": true,
      "third@": true,
    },
    extraKnownMarketplaces: { ignored: "source" },
  };

  // act
  const result = extractEnabledPluginRefs("user", settings);

  // assert
  assert.deepEqual(result, {
    diagnostics: [
      {
        code: "malformed-plugin-ref",
        message:
          'Skipping malformed enabled plugin ref "malformed": Expected exactly one @ separator in plugin@marketplace ref. Expected plugin@marketplace.',
        ref: "malformed",
        scope: "user",
        severity: "warning",
      },
      {
        code: "non-boolean-enabled-plugin",
        message:
          'Skipping enabled plugin ref "not-boolean@marketplace" because its value is not boolean true or false.',
        ref: "not-boolean@marketplace",
        scope: "user",
        severity: "warning",
      },
      {
        code: "malformed-plugin-ref",
        message:
          'Skipping malformed enabled plugin ref "third@": Expected non-empty plugin and marketplace in plugin@marketplace ref. Expected plugin@marketplace.',
        ref: "third@",
        scope: "user",
        severity: "warning",
      },
    ],
    refs: [
      { marketplace: "marketplace", plugin: "first", raw: "first@marketplace" },
      {
        marketplace: "another-marketplace",
        plugin: "second",
        raw: "  second  @  another-marketplace  ",
      },
    ],
  });
});
