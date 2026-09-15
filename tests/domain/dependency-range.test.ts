import assert from "node:assert/strict";
import { test } from "node:test";

import { minVersion, validRange } from "semver";

import {
  intersectDependencyRanges,
  recordedVersionSatisfies,
  renderConstraintRange,
  type DependencyRangeFailureReason,
  type DependencyRangeIntersection,
} from "../../extensions/pi-claude-marketplace/domain/dependency-range.ts";

void ({ ok: true, range: "*" } satisfies DependencyRangeIntersection);
void ({
  ok: false,
  reason: "disjoint",
  detail: "no version satisfies all 2 declared ranges",
} satisfies DependencyRangeIntersection);
void ("too-complex" satisfies DependencyRangeFailureReason);
// @ts-expect-error The failure vocabulary is closed at three reasons.
void ("no-matching-tag" satisfies DependencyRangeFailureReason);
// @ts-expect-error A successful intersection carries a range and no reason.
void ({ ok: true, reason: "invalid" } satisfies DependencyRangeIntersection);

test("D-03-02.1 an empty accumulator of declared ranges is no constraint", () => {
  // arrange
  const declared: readonly string[] = [];

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, { ok: true, range: "*" });
});

test("D-03-02.1 a single declared range intersects to its canonical form", () => {
  // arrange
  const declared = ["^1.0.0"];

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, { ok: true, range: ">=1.0.0 <2.0.0-0" });
});

test("RESV-03 two overlapping ranges intersect to the versions both admit", () => {
  // arrange
  const declared = ["^1.0.0", ">=1.5.0"];

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, { ok: true, range: ">=1.0.0 <2.0.0-0 >=1.5.0" });
  assert.equal(recordedVersionSatisfies("1.5.0", ">=1.0.0 <2.0.0-0 >=1.5.0"), true);
  assert.equal(recordedVersionSatisfies("1.4.9", ">=1.0.0 <2.0.0-0 >=1.5.0"), false);
  assert.equal(recordedVersionSatisfies("2.0.0", ">=1.0.0 <2.0.0-0 >=1.5.0"), false);
});

test("D-03-02.1 a union-bearing input multiplies the branch count and drops the disjoint cells", () => {
  // arrange
  const declared = ["1.x || 2.x", "1.5.x || 2.5.x"];

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, {
    ok: true,
    range: ">=1.0.0 <2.0.0-0 >=1.5.0 <1.6.0-0||>=2.0.0 <3.0.0-0 >=2.5.0 <2.6.0-0",
  });
});

test("RESV-03 a disjoint pair fails as a conflict rather than as a range matching nothing", () => {
  // arrange
  const declared = [">=2.0.0", "<1.0.0"];

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert: the control rides in the same whole value. A range VALIDATOR
  // accepts the conjunct this pair produces, so a filter written on validity
  // alone would hand it back as a usable range; only the minimum-version test
  // refuses it.
  assert.deepStrictEqual(
    {
      intersected,
      validatorAccepts: validRange(">=2.0.0 <1.0.0"),
      minimumVersion: minVersion(">=2.0.0 <1.0.0"),
    },
    {
      intersected: {
        ok: false,
        reason: "disjoint",
        detail: "no version satisfies all 2 declared ranges",
      },
      validatorAccepts: ">=2.0.0 <1.0.0",
      minimumVersion: null,
    },
  );
});

test("RESV-03 an unparseable declared range names its position and no sibling's text", () => {
  // arrange
  const declared = ["^1.0.0", "not-a-range"];

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, {
    ok: false,
    reason: "invalid",
    detail: "input 2 of 2 is not a valid version range",
  });
});

test("T-03-07 total input characters are measured before any range is parsed", () => {
  // arrange: the second element is not a range at all, so a reason of
  // "invalid" would prove the parser ran before the size guard.
  const declared = ["^1.0.0", "x".repeat(4096)];

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, {
    ok: false,
    reason: "too-complex",
    detail: "total input 4102 characters exceeds the 4096 character cap",
  });
});

test("T-03-07 a cross-product over the conjunct cap fails before the product is allocated", () => {
  // arrange: twelve four-branch inputs project to 16,777,216 conjuncts. The
  // walk refuses at the sixth input, so nothing is allocated; a cap tested
  // after the product would have to build the explosion it exists to refuse.
  const declared = Array.from({ length: 12 }, () => "1.x || 2.x || 3.x || 4.x");

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, {
    ok: false,
    reason: "too-complex",
    detail: "4096 conjuncts after 6 of 12 inputs exceeds the 1024 conjunct cap",
  });
});

test("D-03-02.1 a cross-product under the cap keeps every satisfiable cell and drops the rest", () => {
  // arrange: seven two-branch inputs project to 128 conjuncts, of which only
  // the two whose seven picks share a major admit any version.
  const declared = Array.from({ length: 7 }, () => "1.x || 2.x");
  const sameMajorThroughout = (major: number): string =>
    Array.from({ length: 7 }, () => `>=${major}.0.0 <${major + 1}.0.0-0`).join(" ");

  // act
  const intersected = intersectDependencyRanges(declared);

  // assert
  assert.deepStrictEqual(intersected, {
    ok: true,
    range: `${sameMajorThroughout(1)}||${sameMajorThroughout(2)}`,
  });
});

for (const { label, recorded, range, expected } of [
  {
    label: "a plain version inside the range",
    recorded: "1.2.3",
    range: "^1.0.0",
    expected: true,
  },
  {
    label: "a plain version outside the range",
    recorded: "2.0.0",
    range: "^1.0.0",
    expected: false,
  },
  {
    label: "a prerelease against a range that admits no prerelease",
    recorded: "1.2.3-beta.1",
    range: ">=1.0.0",
    expected: false,
  },
  {
    label: "a prerelease against a range whose bound is itself a prerelease",
    recorded: "1.2.3-beta.1",
    range: ">=1.2.3-alpha <2.0.0",
    expected: true,
  },
  {
    label: "a non-semver string the coercion ladder rescues",
    recorded: "v2",
    range: "^2.0.0",
    expected: true,
  },
  {
    label: "a string that normalizes to nothing",
    recorded: "nope",
    range: "*",
    expected: false,
  },
]) {
  test(`D-03-02.3 the recorded-version ladder resolves ${label}`, () => {
    // arrange
    const candidate = recorded;

    // act
    const satisfied = recordedVersionSatisfies(candidate, range);

    // assert
    assert.equal(satisfied, expected);
  });
}

for (const { form, recorded } of [
  { form: "content-hash", recorded: "hash-abc123def456" },
  { form: "git-sha", recorded: "sha-abc123def456" },
]) {
  test(`D-03-04 a ${form} recorded version runs the unguarded coercion ladder`, () => {
    // arrange: the ladder extracts the digit run "123" from the hexadecimal
    // body and coerces it to 123.0.0. The accepted risk is exactly this -- the
    // answer is a real verdict against a misleading version, not a rejection.
    const range = "^123.0.0";

    // act
    const admitted = recordedVersionSatisfies(recorded, range);
    const refused = recordedVersionSatisfies(recorded, "^1.0.0");

    // assert
    assert.equal(admitted, true);
    assert.equal(refused, false);
  });
}

test("T-03-08 a range at the rendering bound is carried whole", () => {
  // arrange
  const range = ">=1.0.0 ".repeat(25);

  // act
  const rendered = renderConstraintRange(range);

  // assert
  assert.deepStrictEqual({ length: range.length, rendered }, { length: 200, rendered: range });
});

test("T-03-08 a range past the rendering bound is truncated and names what it dropped", () => {
  // arrange
  const range = "x".repeat(250);

  // act
  const rendered = renderConstraintRange(range);

  // assert
  assert.equal(rendered, `${"x".repeat(200)}... (+50 chars)`);
});

test("T-03-08 a range widened by intersection is bounded before it can reach a reason", () => {
  // arrange: the range the sibling cross-product case pins, which runs 238
  // characters -- far past what any single declared version may be, because a
  // synthesized range inherits the declared allowlist's character set and not
  // its length.
  const sameMajorThroughout = (major: number): string =>
    Array.from({ length: 7 }, () => `>=${major}.0.0 <${major + 1}.0.0-0`).join(" ");
  const widened = `${sameMajorThroughout(1)}||${sameMajorThroughout(2)}`;

  // act
  const rendered = renderConstraintRange(widened);

  // assert
  assert.deepStrictEqual(
    { widenedLength: widened.length, rendered },
    {
      widenedLength: 238,
      rendered: `${widened.slice(0, 200)}... (+38 chars)`,
    },
  );
});
