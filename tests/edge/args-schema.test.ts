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

test("parseCommandArgs rejects a positional the schema does not declare", () => {
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
  assert.strictEqual(parsedArgs, undefined);
  assert.deepStrictEqual(usageErrors, ["Too many arguments."]);
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

test("parseCommandArgs rejects a supplied blank optional tail positional", () => {
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
  assert.strictEqual(parsedArgs, undefined);
  assert.deepStrictEqual(usageErrors, ["Argument must not be empty."]);
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

for (const { args, form, diagnostic } of [
  {
    args: "official --scope",
    form: "the last token",
    diagnostic: '--scope requires a value: "user" or "project".',
  },
  {
    args: 'official --scope ""',
    form: "followed by an empty quoted value",
    diagnostic: 'Invalid --scope value: "". Must be "user" or "project".',
  },
]) {
  test(`parseCommandArgs reports the invalid --scope input when the flag is ${form}`, () => {
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
    assert.deepStrictEqual(usageErrors, [diagnostic]);
  });
}

for (const { args, positional, diagnostic } of [
  { args: "surplus", positional: [], diagnostic: "Too many arguments." },
  {
    args: "official surplus",
    positional: [{ name: "marketplace", required: false }],
    diagnostic: "Too many arguments.",
  },
  { args: "--bogus", positional: [], diagnostic: 'Unknown flag: "--bogus".' },
  {
    args: "--bogus official",
    positional: [{ name: "marketplace" }],
    diagnostic: 'Unknown flag: "--bogus".',
  },
  {
    args: "official --bogus",
    positional: [{ name: "marketplace" }],
    diagnostic: 'Unknown flag: "--bogus".',
  },
]) {
  test(`parseCommandArgs rejects ${JSON.stringify(args)} with ${diagnostic}`, () => {
    // arrange
    const usageErrors: string[] = [];
    const schema = { positional, usage: "Usage: test" };

    // act
    const parsed = parseCommandArgs(args, schema, (message) => {
      usageErrors.push(message);
    });

    // assert
    assert.strictEqual(parsed, undefined);
    assert.deepStrictEqual(usageErrors, [diagnostic]);
  });
}

for (const args of ['""', "''"]) {
  test(`parseCommandArgs rejects a supplied empty optional operand ${args}`, () => {
    // arrange
    const usageErrors: string[] = [];
    const schema = {
      positional: [{ name: "marketplace", required: false }] as const,
      usage: "Usage: test",
    };

    // act
    const parsedArgs = parseCommandArgs(args, schema, (message) => {
      usageErrors.push(message);
    });

    // assert
    assert.strictEqual(parsedArgs, undefined);
    assert.deepStrictEqual(usageErrors, ["Argument must not be empty."]);
  });
}
