import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  discoveryWarning,
  hygieneWarning,
  partitionStagingWarnings,
} from "../../extensions/pi-claude-marketplace/shared/staging-warnings.ts";

import type {
  DiscoveryWarning,
  HygieneWarning,
} from "../../extensions/pi-claude-marketplace/shared/staging-warnings.ts";

// @ts-expect-error -- D-PL1-04: a hygiene warning never fits the discovery channel.
void ([hygieneWarning("index entry dropped")] satisfies DiscoveryWarning[]);

describe("discoveryWarning", () => {
  test("tags the message as a discovery warning", () => {
    // arrange
    const message = "skill skipped";

    // act
    const warning = discoveryWarning(message);

    // assert
    assert.deepStrictEqual(warning, { kind: "discovery", message: "skill skipped" });
  });
});

describe("hygieneWarning", () => {
  test("tags the message as a hygiene warning", () => {
    // arrange
    const message = "index entry dropped";

    // act
    const warning = hygieneWarning(message);

    // assert
    assert.deepStrictEqual(warning, { kind: "hygiene", message: "index entry dropped" });
  });
});

describe("partitionStagingWarnings", () => {
  test("splits warnings by tag and keeps the input order inside each half", () => {
    // arrange
    const d1 = { kind: "discovery", message: "d1" } satisfies DiscoveryWarning;
    const h1 = { kind: "hygiene", message: "h1" } satisfies HygieneWarning;
    const d2 = { kind: "discovery", message: "d2" } satisfies DiscoveryWarning;
    const h2 = { kind: "hygiene", message: "h2" } satisfies HygieneWarning;

    // act
    const halves = partitionStagingWarnings([d1, h1, d2, h2]);

    // assert
    assert.deepStrictEqual(halves, {
      discovery: [
        { kind: "discovery", message: "d1" },
        { kind: "discovery", message: "d2" },
      ],
      hygiene: [
        { kind: "hygiene", message: "h1" },
        { kind: "hygiene", message: "h2" },
      ],
    });
  });

  test("returns two empty halves for no warnings", () => {
    // arrange
    const warnings: readonly DiscoveryWarning[] = [];

    // act
    const halves = partitionStagingWarnings(warnings);

    // assert
    assert.deepStrictEqual(halves, { discovery: [], hygiene: [] });
  });
});
