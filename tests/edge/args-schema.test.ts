import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCommandArgs,
  type PositionalSpec,
} from "../../extensions/pi-claude-marketplace/edge/args-schema.ts";

test("parseCommandArgs returns each required positional under its declared name", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [
      { name: "marketplace" },
      { name: "plugin" },
    ] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin install <marketplace> <plugin> [--scope user|project]",
  };

  // act
  const parsedArgs = parseCommandArgs("official alpha", schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, { marketplace: "official", plugin: "alpha" });
  assert.deepStrictEqual(usageErrors, []);
});

// The loop above iterates `schema.positional`, not `parsed.positional`, so an
// index the schema does not declare is never read and a token sitting there is
// discarded without a diagnostic. That is this module's rule and it is
// user-visible -- a mistyped extra word is swallowed rather than reported.
//
// The two callers that rely on it (`tests/edge/handlers/plugin/shared.test.ts`
// and `tests/edge/handlers/marketplace/shared.test.ts`) each keep their own
// claim, which is that they forward the parsed value; neither owns the rule.
//
// The case above is the discriminator: with the same token at index 1 and a
// schema that DOES declare it, the value comes back under its name.
test("parseCommandArgs drops a positional the schema does not declare, with no usage error", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [{ name: "marketplace" }] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin marketplace info <name> [--scope user|project]",
  };

  // act
  const parsedArgs = parseCommandArgs("official surplus", schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, { marketplace: "official" });
  assert.deepStrictEqual(usageErrors, []);
});

for (const { args, placement } of [
  { args: "--scope project official alpha", placement: "before the positionals" },
  { args: "official --scope project alpha", placement: "between the positionals" },
  { args: "official alpha --scope project", placement: "after the positionals" },
]) {
  test(`parseCommandArgs recovers the positionals and the scope with --scope ${placement}`, () => {
    // arrange
    const usageErrors: string[] = [];
    const schema = {
      positional: [
        { name: "marketplace" },
        { name: "plugin" },
      ] as const satisfies readonly PositionalSpec[],
      usage: "Usage: /claude:plugin install <marketplace> <plugin> [--scope user|project]",
    };

    // act
    const parsedArgs = parseCommandArgs(args, schema, (message) => {
      usageErrors.push(message);
    });

    // assert
    assert.deepStrictEqual(parsedArgs, {
      marketplace: "official",
      plugin: "alpha",
      scope: "project",
    });
    assert.deepStrictEqual(usageErrors, []);
  });
}

test("parseCommandArgs sets an optional tail positional the caller supplied", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [
      { name: "marketplace" },
      { name: "plugin", required: false },
    ] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin update <marketplace> [<plugin>]",
  };

  // act
  const parsedArgs = parseCommandArgs("official alpha", schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, { marketplace: "official", plugin: "alpha" });
  assert.deepStrictEqual(usageErrors, []);
});

test("parseCommandArgs omits an absent optional tail positional instead of setting it undefined", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [
      { name: "marketplace" },
      { name: "plugin", required: false },
    ] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin update <marketplace> [<plugin>]",
  };

  // act
  const parsedArgs = parseCommandArgs("official", schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, { marketplace: "official" });
  assert.deepStrictEqual(usageErrors, []);
});

test("parseCommandArgs omits a blank optional tail positional and reports no usage error", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [
      { name: "marketplace" },
      { name: "plugin", required: false },
    ] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin update <marketplace> [<plugin>]",
  };

  // act
  const parsedArgs = parseCommandArgs('official "   "', schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, { marketplace: "official" });
  assert.deepStrictEqual(usageErrors, []);
});

test("parseCommandArgs reports usage and yields nothing when a required positional is absent", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [
      { name: "marketplace" },
      { name: "plugin" },
    ] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin install <marketplace> <plugin> [--scope user|project]",
  };

  // act
  const parsedArgs = parseCommandArgs("official", schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, undefined);
  assert.deepStrictEqual(usageErrors, [
    "Usage: /claude:plugin install <marketplace> <plugin> [--scope user|project]",
  ]);
});

test("parseCommandArgs reports usage and yields nothing when a required positional is blank", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [
      { name: "marketplace" },
      { name: "plugin" },
    ] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin install <marketplace> <plugin> [--scope user|project]",
  };

  // act
  const parsedArgs = parseCommandArgs('official "   "', schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, undefined);
  assert.deepStrictEqual(usageErrors, [
    "Usage: /claude:plugin install <marketplace> <plugin> [--scope user|project]",
  ]);
});

for (const { args, shape } of [
  { args: "", shape: "an empty argument string" },
  { args: "   ", shape: "separator whitespace alone" },
]) {
  test(`parseCommandArgs reports usage for a required positional given ${shape}`, () => {
    // arrange
    const usageErrors: string[] = [];
    const schema = {
      positional: [{ name: "marketplace" }] as const satisfies readonly PositionalSpec[],
      usage: "Usage: /claude:plugin marketplace remove <marketplace>",
    };

    // act
    const parsedArgs = parseCommandArgs(args, schema, (message) => {
      usageErrors.push(message);
    });

    // assert
    assert.deepStrictEqual(parsedArgs, undefined);
    assert.deepStrictEqual(usageErrors, ["Usage: /claude:plugin marketplace remove <marketplace>"]);
  });
}

test("parseCommandArgs accepts an empty argument string against a schema declaring no positional", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin list [--scope user|project]",
  };

  // act
  const parsedArgs = parseCommandArgs("", schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, {});
  assert.deepStrictEqual(usageErrors, []);
});

test("parseCommandArgs reports the tokenizer diagnostic and never reaches positional validation", () => {
  // arrange
  const usageErrors: string[] = [];
  const schema = {
    positional: [{ name: "marketplace" }] as const satisfies readonly PositionalSpec[],
    usage: "Usage: /claude:plugin marketplace remove <marketplace>",
  };

  // act
  const parsedArgs = parseCommandArgs("official --scope bogus", schema, (message) => {
    usageErrors.push(message);
  });

  // assert
  assert.deepStrictEqual(parsedArgs, undefined);
  assert.deepStrictEqual(usageErrors, [
    'Invalid --scope value: "bogus". Must be "user" or "project".',
  ]);
});

for (const { args, form } of [
  { args: "official --scope", form: "the last token" },
  { args: 'official --scope ""', form: "followed by an empty quoted value" },
]) {
  test(`parseCommandArgs reports the missing --scope value when the flag is ${form}`, () => {
    // arrange
    const usageErrors: string[] = [];
    const schema = {
      positional: [{ name: "marketplace" }] as const satisfies readonly PositionalSpec[],
      usage: "Usage: /claude:plugin marketplace remove <marketplace>",
    };

    // act
    const parsedArgs = parseCommandArgs(args, schema, (message) => {
      usageErrors.push(message);
    });

    // assert
    assert.deepStrictEqual(parsedArgs, undefined);
    assert.deepStrictEqual(usageErrors, ['--scope requires a value: "user" or "project".']);
  });
}
