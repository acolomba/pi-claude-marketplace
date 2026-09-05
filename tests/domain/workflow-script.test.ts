import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  admitWorkflowScript,
  assertNoWorkflowNameCollisions,
  fileStem,
  WORKFLOW_SCRIPT_EXTENSIONS,
  type AdmittedWorkflow,
  type NamedWorkflow,
  type RefusedCause,
  type RefusedWorkflow,
  type SkippedCause,
  type SkippedWorkflow,
  type StemFallbackWorkflow,
  type WorkflowVerdict,
} from "../../extensions/pi-claude-marketplace/domain/workflow-script.ts";
import { WorkflowNameCollisionError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

/**
 * The two projections every verdict assertion compares. `reason` is deliberately
 * dropped: it is the only field that changes when wording is edited, and
 * discriminating a verdict by its human-readable text is the failure mode the
 * literal-tagged union exists to remove.
 */
interface NonAdmission {
  readonly outcome: WorkflowVerdict["outcome"];
  readonly cause: SkippedCause | RefusedCause | undefined;
}

interface Admission {
  readonly outcome: WorkflowVerdict["outcome"];
  readonly metaName: string | undefined;
  readonly generatedName: string | undefined;
}

function nonAdmission(verdict: WorkflowVerdict): NonAdmission {
  return {
    outcome: verdict.outcome,
    cause:
      verdict.outcome === "skipped" || verdict.outcome === "refused" ? verdict.cause : undefined,
  };
}

function admission(verdict: WorkflowVerdict): Admission {
  return {
    outcome: verdict.outcome,
    metaName: verdict.outcome === "named" ? verdict.metaName : undefined,
    generatedName:
      verdict.outcome === "named" || verdict.outcome === "stem-fallback"
        ? verdict.generatedName
        : undefined,
  };
}

interface DecoyRow {
  readonly decoy: string;
  readonly source: string;
  readonly metaName: string;
  readonly generatedName: string;
}

interface SkipRow {
  readonly shape: string;
  readonly source: string;
  readonly cause: SkippedCause;
}

interface StemRow {
  readonly shape: string;
  readonly fileName: string;
  readonly source: string;
  readonly generatedName: string;
}

interface UnsafeNameRow {
  readonly flaw: string;
  readonly metaName: string;
}

interface DeterminismRow {
  readonly placement: string;
  readonly source: string;
  readonly cause: RefusedCause;
}

interface StemDropRow {
  readonly fileName: string;
  readonly stem: string;
}

interface EncodingRow {
  readonly encoding: string;
  readonly source: string;
}

describe("admitWorkflowScript", () => {
  for (const { decoy, source, metaName, generatedName } of [
    {
      decoy: "a usage comment naming a different name",
      source: `// Usage: set meta = { name: 'WRONG-from-comment' } at the top.
export const meta = { name: 'right-from-ast', description: 'x' };
return 1;
`,
      metaName: "right-from-ast",
      generatedName: "acme:right-from-ast",
    },
    {
      decoy: "a help string quoting a different name",
      source: `const help = "name: 'WRONG-from-string'";
export const meta = { name: 'right-again', description: 'x' };
return help;
`,
      metaName: "right-again",
      generatedName: "acme:right-again",
    },
    {
      decoy: "a double-quoted name key",
      source: `export const meta = { "name": "quoted-key", description: 'x' };
return 1;
`,
      metaName: "quoted-key",
      generatedName: "acme:quoted-key",
    },
  ] satisfies readonly DecoyRow[]) {
    test(`reads the declared name past ${decoy}`, () => {
      // arrange
      const expectedVerdict = {
        outcome: "named",
        metaName,
        generatedName,
      } satisfies Admission;

      // act
      const verdict = admitWorkflowScript("acme", "drafter.workflow.js", source);

      // assert
      assert.deepStrictEqual(admission(verdict), expectedVerdict);
    });
  }

  test("elides the plugin prefix from the declared name", () => {
    // arrange
    const source = `export const meta = { name: "acme-audit" };\n`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "acme-audit",
      generatedName: "acme:audit",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "audit.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });

  test("reads a substitution-free template literal, the one non-Literal form the engine resolves", () => {
    // arrange
    // `evaluateLiteral` joins the quasis of a template with no substitutions and
    // throws only when there is at least one, so the engine reads this name.
    // Stem-naming it would misname a command the engine can already load.
    const source = `export const meta = { name: \`deploy\`, description: "d" };\n`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "deploy",
      generatedName: "acme:deploy",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "shipper.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });

  test("cooks the escapes in a template-literal name rather than reading its raw text", () => {
    // arrange
    // `cooked` and `raw` diverge the moment an escape appears, and `cooked` is
    // what the engine reads. A raw read would name the command "a\\tb".
    const source = `export const meta = { name: \`a\\u002Db\` };\n`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "a-b",
      generatedName: "acme:a-b",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "shipper.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });

  test("reads past a numeric meta key that no static key name can match", () => {
    // arrange
    const source = `export const meta = { 1: "x", name: "ship" };\n`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "ship",
      generatedName: "acme:ship",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });

  test("reads past a computed meta key, which is not statically knowable", () => {
    // arrange
    const source = `export const meta = { [chosenKey]: "x", name: "ship" };\n`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "ship",
      generatedName: "acme:ship",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });

  test("lets a literal name that follows a spread win, because the read is last-wins", () => {
    // arrange
    const source = `const extra = {};
export const meta = { ...extra, name: "ship" };
`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "ship",
      generatedName: "acme:ship",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });

  for (const { shape, source, cause } of [
    {
      shape: "declares no meta at all",
      source: `return 42;\n`,
      cause: "no-meta",
    },
    {
      shape: "initializes meta from a call expression",
      source: `export const meta = makeMeta();\n`,
      cause: "meta-not-object-literal",
    },
    {
      shape: "declares meta with no initializer at all",
      source: `let meta;\n`,
      cause: "meta-not-object-literal",
    },
    {
      shape: "carries a spread after its last literal name",
      source: `const extra = {};
export const meta = { name: "ship", ...extra };
`,
      cause: "meta-spread",
    },
  ] satisfies readonly SkipRow[]) {
    test(`skips a script that ${shape}`, () => {
      // arrange
      const expectedVerdict = { outcome: "skipped", cause } satisfies NonAdmission;

      // act
      const verdict = admitWorkflowScript("acme", "helper.js", source);

      // assert
      assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
    });
  }

  test("skips an empty script for declaring no meta, rather than refusing it as unparseable", () => {
    // arrange
    const source = "";
    const expectedVerdict = { outcome: "skipped", cause: "no-meta" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "empty.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  test("refuses genuinely invalid syntax as unparseable", () => {
    // arrange
    const source = `export const meta = { name: 'oops'\n`;
    const expectedVerdict = { outcome: "refused", cause: "unparseable" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "broken.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  test("settles unparseable before the determinism scan when a script is both", () => {
    // arrange
    const source = `const stamped = Date.now();
export const meta = { name: 'oops'
`;
    const expectedVerdict = { outcome: "refused", cause: "unparseable" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "broken-clock.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  test("settles the meta lookup before the determinism scan when a helper module is both", () => {
    // arrange
    const source = `export function stamp() {
  return Date.now();
}
`;
    const expectedVerdict = { outcome: "skipped", cause: "no-meta" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "utils.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  for (const { shape, fileName, source, generatedName } of [
    {
      shape: "meta declares a description but no name key",
      fileName: "drafter.workflow.js",
      source: `export const meta = { description: "d" };\n`,
      generatedName: "acme:drafter.workflow",
    },
    {
      shape: "the name is a template literal carrying a substitution",
      fileName: "shipper.js",
      source: `export const meta = { name: \`a\${chosen}b\` };\n`,
      generatedName: "acme:shipper",
    },
    {
      shape: "the name is a string concatenation",
      fileName: "joiner.js",
      source: `export const meta = { name: "never" + "-evaluated" };\n`,
      generatedName: "acme:joiner",
    },
    {
      shape: "the name is a numeric literal",
      fileName: "numbered.js",
      source: `export const meta = { name: 42 };\n`,
      generatedName: "acme:numbered",
    },
    {
      shape: "the name is a bare identifier",
      fileName: "ident.js",
      source: `export const meta = { name: chosenName };\n`,
      generatedName: "acme:ident",
    },
  ] satisfies readonly StemRow[]) {
    test(`falls back to the file stem when ${shape}`, () => {
      // arrange
      const expectedVerdict = {
        outcome: "stem-fallback",
        metaName: undefined,
        generatedName,
      } satisfies Admission;

      // act
      const verdict = admitWorkflowScript("acme", fileName, source);

      // assert
      assert.deepStrictEqual(admission(verdict), expectedVerdict);
    });
  }

  test("refuses this file alone when the stem it falls back to is itself unusable", () => {
    // arrange
    const source = `export const meta = { description: "d" };\n`;
    const expectedVerdict = { outcome: "refused", cause: "unsafe-name" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "weekly report.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  test("refuses an empty string name, which is neither a stem fallback nor a skip", () => {
    // arrange
    const source = `export const meta = { name: "" };\n`;
    const expectedVerdict = { outcome: "refused", cause: "unsafe-name" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "drafter.workflow.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  for (const { flaw, metaName } of [
    { flaw: "a path separator", metaName: "reports/weekly" },
    { flaw: "an interior space", metaName: "weekly report" },
  ] satisfies readonly UnsafeNameRow[]) {
    test(`refuses this file alone when its declared name carries ${flaw}`, () => {
      // arrange
      const source = `export const meta = { name: ${JSON.stringify(metaName)} };\n`;
      const expectedVerdict = { outcome: "refused", cause: "unsafe-name" } satisfies NonAdmission;

      // act
      const verdict = admitWorkflowScript("acme", "reporter.workflow.js", source);

      // assert
      assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
    });
  }

  test("throws on an unsafe plugin name, because no single file is at fault", () => {
    // arrange
    const source = `export const meta = { name: "ship" };\n`;

    // act & assert
    assert.throws(
      () => admitWorkflowScript("bad/plugin", "ship.workflow.js", source),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(
          error.message,
          'plugin name "bad/plugin" must not contain path separators.',
        );
        return true;
      },
    );
  });

  for (const { placement, source, cause } of [
    {
      placement: "in executable code",
      source: `export const meta = { description: "d" };
const stamped = Date.now();
`,
      cause: "determinism-code",
    },
    {
      placement: "only inside a line comment",
      source: `// Header: we avoid Date.now() for resume safety.
export const meta = { description: "d" };
`,
      cause: "determinism-comment",
    },
    {
      placement: "only inside a string literal",
      source: `const help = "Math.random is avoided on purpose";
export const meta = { description: "d" };
`,
      cause: "determinism-string",
    },
    {
      placement: "only inside a regular-expression literal",
      source: `const stamp = /Date.now/;
export const meta = { description: "d" };
`,
      cause: "determinism-string",
    },
    {
      placement: "straddling the boundary between a comment and code",
      source: `// beware new
Date();
export const meta = { description: "d" };
`,
      cause: "determinism-split",
    },
  ] satisfies readonly DeterminismRow[]) {
    test(`refuses a blocklisted token sitting ${placement}`, () => {
      // arrange
      const expectedVerdict = { outcome: "refused", cause } satisfies NonAdmission;

      // act
      const verdict = admitWorkflowScript("acme", "drafter.workflow.js", source);

      // assert
      assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
    });
  }

  test("lets the first executable match decide a script that also mentions the token elsewhere", () => {
    // arrange
    const source = `// we avoid Date.now() here
export const meta = { description: "d" };
const stamped = Date.now();
`;
    const expectedVerdict = {
      outcome: "refused",
      cause: "determinism-code",
    } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "mixed.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  test("refuses the same source on a second scan, so no match position is carried over", () => {
    // arrange
    const source = `const stamped = Date.now();
export const meta = { name: "ship" };
const restamped = Date.now();
`;
    const expectedVerdict = {
      outcome: "refused",
      cause: "determinism-code",
    } satisfies NonAdmission;

    // act
    const firstVerdict = admitWorkflowScript("acme", "clock.js", source);
    const secondVerdict = admitWorkflowScript("acme", "clock.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(firstVerdict), expectedVerdict);
    assert.deepStrictEqual(nonAdmission(secondVerdict), expectedVerdict);
  });

  test("gives one source the same verdict whether or not another source was read between", () => {
    // arrange
    const shipSource = `export const meta = { name: "ship" };\n`;
    const auditSource = `export const meta = { name: "audit" };\n`;
    const expectedShipVerdict = {
      outcome: "named",
      metaName: "ship",
      generatedName: "acme:ship",
    } satisfies Admission;
    const expectedAuditVerdict = {
      outcome: "named",
      metaName: "audit",
      generatedName: "acme:audit",
    } satisfies Admission;

    // act
    const firstShipVerdict = admitWorkflowScript("acme", "ship.workflow.js", shipSource);
    const auditVerdict = admitWorkflowScript("acme", "audit.workflow.js", auditSource);
    const secondShipVerdict = admitWorkflowScript("acme", "ship.workflow.js", shipSource);

    // assert
    assert.deepStrictEqual(admission(firstShipVerdict), expectedShipVerdict);
    assert.deepStrictEqual(admission(auditVerdict), expectedAuditVerdict);
    assert.deepStrictEqual(admission(secondShipVerdict), expectedShipVerdict);
  });

  for (const { encoding, source } of [
    {
      // U+FEFF BYTE ORDER MARK, written as an escape because it is invisible in
      // source. A UTF-8 BOM is common in real files, so acorn accepting it is
      // load-bearing: were it ever to become `unparseable`, every workflow in a
      // BOM-carrying plugin would silently stop installing.
      encoding: "a leading byte-order mark",
      source: `\uFEFFexport const meta = { name: "ship" };\n`,
    },
    {
      // U+D800, a lone high surrogate. It sits in an unrelated string literal,
      // so it never reaches the name and must not disturb the read.
      encoding: "a lone surrogate in an unrelated literal",
      source: `const marker = "\uD800";\nexport const meta = { name: "ship" };\n`,
    },
  ] satisfies readonly EncodingRow[]) {
    test(`reads the declared name from a source carrying ${encoding}`, () => {
      // arrange
      const expectedVerdict = {
        outcome: "named",
        metaName: "ship",
        generatedName: "acme:ship",
      } satisfies Admission;

      // act
      const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

      // assert
      assert.deepStrictEqual(admission(verdict), expectedVerdict);
    });
  }

  test("refuses a source whose replacement characters make it unparseable", () => {
    // arrange
    // U+FFFD REPLACEMENT CHARACTER is not a valid identifier start, so a decode
    // that already lost bytes reaches acorn as a syntax error rather than as a
    // name. This row is split from the two above because its outcome differs.
    const source = `const \uFFFD = 1;\nexport const meta = { name: "ship" };\n`;
    const expectedVerdict = { outcome: "refused", cause: "unparseable" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });
});

describe("assertNoWorkflowNameCollisions", () => {
  test("accepts an empty verdict set", () => {
    // arrange
    const verdicts: readonly WorkflowVerdict[] = [];

    // act & assert
    assert.doesNotThrow(() => {
      assertNoWorkflowNameCollisions(verdicts);
    });
  });

  test("accepts a single admitted verdict", () => {
    // arrange
    const verdicts = [
      {
        outcome: "named",
        fileName: "ship.workflow.js",
        metaName: "ship",
        generatedName: "acme:ship",
      },
    ] satisfies readonly NamedWorkflow[];

    // act & assert
    assert.doesNotThrow(() => {
      assertNoWorkflowNameCollisions(verdicts);
    });
  });

  test("reports both claimants when two declared names resolve to one command name", () => {
    // arrange
    const verdicts = [
      {
        outcome: "named",
        fileName: "ship.workflow.js",
        metaName: "ship",
        generatedName: "acme:ship",
      },
      {
        outcome: "named",
        fileName: "deploy.workflow.js",
        metaName: "acme-ship",
        generatedName: "acme:ship",
      },
    ] satisfies readonly NamedWorkflow[];

    // act & assert
    assert.throws(
      () => {
        assertNoWorkflowNameCollisions(verdicts);
      },
      (error: unknown) => {
        assert.ok(error instanceof WorkflowNameCollisionError);
        assert.deepStrictEqual(error.collisions, [
          {
            generatedName: "acme:ship",
            fileNames: ["ship.workflow.js", "deploy.workflow.js"],
          },
        ]);
        return true;
      },
    );
  });

  test("collides a named verdict with a stem-fallback one, because both carry a name", () => {
    // arrange
    const named = {
      outcome: "named",
      fileName: "ship.workflow.js",
      metaName: "ship",
      generatedName: "acme:ship",
    } satisfies NamedWorkflow;
    const stemFallback = {
      outcome: "stem-fallback",
      fileName: "ship.js",
      generatedName: "acme:ship",
    } satisfies StemFallbackWorkflow;
    const verdicts = [named, stemFallback] satisfies readonly AdmittedWorkflow[];

    // act & assert
    assert.throws(
      () => {
        assertNoWorkflowNameCollisions(verdicts);
      },
      (error: unknown) => {
        assert.ok(error instanceof WorkflowNameCollisionError);
        assert.deepStrictEqual(error.collisions, [
          { generatedName: "acme:ship", fileNames: ["ship.workflow.js", "ship.js"] },
        ]);
        return true;
      },
    );
  });

  test("accepts skipped and refused verdicts that share a file name, since neither claims one", () => {
    // arrange
    const skipped = {
      outcome: "skipped",
      fileName: "helper.js",
      reason: "helper.js declares no `meta`, so there is nothing to install",
      cause: "no-meta",
    } satisfies SkippedWorkflow;
    const refused = {
      outcome: "refused",
      fileName: "helper.js",
      reason: "helper.js is not parseable JavaScript, so no name can be read from it",
      cause: "unparseable",
    } satisfies RefusedWorkflow;
    const verdicts = [skipped, refused] satisfies readonly WorkflowVerdict[];

    // act & assert
    assert.doesNotThrow(() => {
      assertNoWorkflowNameCollisions(verdicts);
    });
  });

  test("groups two independent collisions by first-seen name with claimants in caller order", () => {
    // arrange
    const verdicts = [
      {
        outcome: "named",
        fileName: "a.workflow.js",
        metaName: "ship",
        generatedName: "acme:ship",
      },
      {
        outcome: "named",
        fileName: "b.workflow.js",
        metaName: "audit",
        generatedName: "acme:audit",
      },
      {
        outcome: "named",
        fileName: "c.workflow.js",
        metaName: "acme-ship",
        generatedName: "acme:ship",
      },
      {
        outcome: "named",
        fileName: "d.workflow.js",
        metaName: "acme-audit",
        generatedName: "acme:audit",
      },
      {
        outcome: "named",
        fileName: "e.workflow.js",
        metaName: "ship",
        generatedName: "acme:ship",
      },
    ] satisfies readonly NamedWorkflow[];

    // act & assert
    assert.throws(
      () => {
        assertNoWorkflowNameCollisions(verdicts);
      },
      (error: unknown) => {
        assert.ok(error instanceof WorkflowNameCollisionError);
        assert.deepStrictEqual(error.collisions, [
          {
            generatedName: "acme:ship",
            fileNames: ["a.workflow.js", "c.workflow.js", "e.workflow.js"],
          },
          { generatedName: "acme:audit", fileNames: ["b.workflow.js", "d.workflow.js"] },
        ]);
        return true;
      },
    );
  });

  test("compares names as exact strings, so two normalization forms do not collide here", () => {
    // arrange
    const composedName = "acme:caf\u00E9";
    const decomposedName = "acme:cafe\u0301";
    const verdicts = [
      {
        outcome: "named",
        fileName: "composed.workflow.js",
        metaName: "caf\u00E9",
        generatedName: composedName,
      },
      {
        outcome: "named",
        fileName: "decomposed.workflow.js",
        metaName: "cafe\u0301",
        generatedName: decomposedName,
      },
    ] satisfies readonly NamedWorkflow[];

    // act & assert
    assert.notStrictEqual(composedName, decomposedName);
    assert.doesNotThrow(() => {
      assertNoWorkflowNameCollisions(verdicts);
    });
  });
});

describe("fileStem", () => {
  test("lists the script suffixes the stem drops, in declaration order", () => {
    // arrange
    const expectedExtensions = [".js", ".mjs", ".cjs"];

    // act
    const extensions = [...WORKFLOW_SCRIPT_EXTENSIONS];

    // assert
    assert.deepStrictEqual(extensions, expectedExtensions);
  });

  for (const { fileName, stem } of [
    { fileName: "drafter.js", stem: "drafter" },
    { fileName: "drafter.mjs", stem: "drafter" },
    { fileName: "drafter.cjs", stem: "drafter" },
    { fileName: "Drafter.JS", stem: "Drafter" },
    { fileName: "drafter.workflow.js", stem: "drafter.workflow" },
    { fileName: "README.md", stem: "README.md" },
    { fileName: "drafter.js.txt", stem: "drafter.js.txt" },
  ] satisfies readonly StemDropRow[]) {
    test(`derives ${JSON.stringify(stem)} from ${JSON.stringify(fileName)}`, () => {
      // arrange
      const expectedStem = stem;

      // act
      const derivedStem = fileStem(fileName);

      // assert
      assert.strictEqual(derivedStem, expectedStem);
    });
  }
});
