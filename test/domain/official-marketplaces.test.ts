import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  effectiveMarketplaceAutoupdate,
  isOfficialMarketplaceName,
} from "../../extensions/pi-claude-marketplace/domain/official-marketplaces.ts";

const OFFICIAL_NAMES = [
  "claude-code-marketplace",
  "claude-code-plugins",
  "claude-plugins-official",
  "anthropic-marketplace",
  "anthropic-plugins",
  "agent-skills",
  "anthropic-agent-skills",
  "life-sciences",
  "knowledge-work-plugins",
  "claude-for-legal",
  "claude-for-financial-services",
  "financial-services-plugins",
  "first-party-plugins",
  "claude-tag-plugins",
] as const;

describe("isOfficialMarketplaceName", () => {
  for (const name of OFFICIAL_NAMES) {
    test(`recognizes ${name} in lower and upper case`, () => {
      // act
      const verdicts = [
        isOfficialMarketplaceName(name),
        isOfficialMarketplaceName(name.toUpperCase()),
      ];

      // assert
      assert.deepStrictEqual(verdicts, [true, true]);
    });
  }

  for (const name of ["tools", "claude-plugins-official-fork", ""]) {
    test(`rejects the name "${name}"`, () => {
      // act
      const official = isOfficialMarketplaceName(name);

      // assert
      assert.strictEqual(official, false);
    });
  }
});

describe("effectiveMarketplaceAutoupdate", () => {
  for (const { name, autoupdate } of [
    { name: "claude-plugins-official", autoupdate: true },
    { name: "Claude-Plugins-Official", autoupdate: true },
    { name: "anthropic-agent-skills", autoupdate: true },
    { name: "knowledge-work-plugins", autoupdate: false },
    { name: "First-Party-Plugins", autoupdate: false },
    { name: "tools", autoupdate: false },
  ]) {
    test(`D-PL8-07: defaults ${name} without a config value to ${autoupdate}`, () => {
      // act
      const effective = effectiveMarketplaceAutoupdate(name, undefined);

      // assert
      assert.strictEqual(effective, autoupdate);
    });
  }

  for (const { name, value } of [
    { name: "claude-plugins-official", value: false },
    { name: "knowledge-work-plugins", value: true },
    { name: "tools", value: true },
    { name: "tools", value: false },
  ]) {
    test(`keeps the config value ${value} of ${name}`, () => {
      // act
      const effective = effectiveMarketplaceAutoupdate(name, value);

      // assert
      assert.strictEqual(effective, value);
    });
  }
});
