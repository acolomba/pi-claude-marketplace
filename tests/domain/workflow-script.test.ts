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
  type WorkflowGate,
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

/**
 * WGATE-01: the verdict projection the gate cases compare -- the arm the script
 * settled on, and the engine gate it was read as tripping.
 *
 * The gate is asserted by NAME on every row rather than as "some gate is
 * present": a reader that walked its gates in the wrong order, or fired the
 * wrong predicate, is green against a presence check.
 */
interface GateReading {
  readonly outcome: WorkflowVerdict["outcome"];
  readonly gate: WorkflowGate | undefined;
}

function gateReading(verdict: WorkflowVerdict): GateReading {
  return {
    outcome: verdict.outcome,
    gate:
      verdict.outcome === "named" || verdict.outcome === "stem-fallback" ? verdict.gate : undefined,
  };
}

interface GateRow {
  readonly shape: string;
  readonly source: string;
  readonly outcome: "named" | "stem-fallback";
  readonly gate: WorkflowGate | undefined;
}

/**
 * WGATE-04: the refusal projection, `reason` INCLUDED.
 *
 * The `NonAdmission` projection above drops the reason on purpose, because
 * discriminating a verdict by its text is what the tagged union exists to
 * remove. These cases are the exception that proves the text itself: the two
 * refusal paths keep their existing bytes, so the bytes are the assertion.
 */
interface Refusal {
  readonly outcome: WorkflowVerdict["outcome"];
  readonly cause: SkippedCause | RefusedCause | undefined;
  readonly reason: string | undefined;
}

function refusal(verdict: WorkflowVerdict): Refusal {
  const settled = verdict.outcome === "skipped" || verdict.outcome === "refused";

  return {
    outcome: verdict.outcome,
    cause: settled ? verdict.cause : undefined,
    reason: settled ? verdict.reason : undefined,
  };
}

interface RefusalTextRow {
  readonly placement: string;
  readonly source: string;
  readonly cause: RefusedCause;
  readonly reason: string;
}

interface UntrustedTextRow {
  readonly threat: string;
  readonly fileName: string;
  readonly source: string;
  readonly outcome: "skipped" | "refused";
  readonly cause: SkippedCause | RefusedCause;
  readonly escaped: string;
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

  test("lets a literal name that follows a computed key win, because the read is last-wins", () => {
    // arrange
    // A computed key can supply or overwrite `name`, but a literal `name` AFTER
    // it is the value the evaluated object ends up with -- the same argument the
    // spread row below makes.
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

  test("lets the last of two meta declarators win, because that is the one the module keeps", () => {
    // arrange
    // `var` redeclaration is legal at module top level and the second binding is
    // the surviving one, so reporting "first" would name a command the evaluated
    // script never carries.
    const source = `var meta = { name: "first" };
var meta = { name: "second" };
`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "second",
      generatedName: "acme:second",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
  });

  test("lets a later non-object meta declarator supersede an earlier object literal", () => {
    // arrange
    const source = `var meta = { name: "first" };
var meta = makeMeta();
`;
    const expectedVerdict = {
      outcome: "skipped",
      cause: "meta-not-object-literal",
    } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.workflow.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
  });

  test("keeps an object literal a later init-less meta declarator only re-declares", () => {
    // arrange
    // `var meta;` re-declares without rebinding, so JavaScript leaves `meta`
    // holding the object (`var x = 1; var x;` leaves `x === 1`). Reporting
    // `meta-not-object-literal` here would make the user-facing reason a false
    // statement about the file. `makeMeta()` in the row above cannot catch this,
    // because it rebinds.
    const source = `var meta = { name: "first" };
var meta;
`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "first",
      generatedName: "acme:first",
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
    {
      // A computed key is the element with the STRONGEST claim on `name`:
      // `{ name: "x", ["na" + "me"]: "y" }` leaves `meta.name` as "y". Reading
      // past it would mint "acme:x", a name the evaluated object never carries.
      shape: "carries a computed key after its last literal name",
      source: `export const meta = { name: "ship", ["na" + "me"]: "other" };\n`,
      cause: "meta-computed-key",
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

  test("refuses the same source on every scan, so no match position is carried over", () => {
    // arrange
    // ONE occurrence and THREE scans. A matcher that retained `lastIndex` finds
    // nothing on the second pass -- admitting a script the engine refuses -- and
    // resets, so it matches again on the third. A two-occurrence fixture or a
    // two-scan test stays green through exactly that bug.
    const source = `const stamped = Date.now();
export const meta = { name: "ship" };
`;
    const expectedVerdict = {
      outcome: "refused",
      cause: "determinism-code",
    } satisfies NonAdmission;

    // act
    const verdicts = [1, 2, 3].map(() => admitWorkflowScript("acme", "clock.js", source));

    // assert
    assert.deepStrictEqual(verdicts.map(nonAdmission), [
      expectedVerdict,
      expectedVerdict,
      expectedVerdict,
    ]);
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

  for (const { threat, fileName, source, outcome, cause, escaped } of [
    {
      threat: "a newline in the file name that reaches a refusal, which would forge an output line",
      fileName: "ok.js\nInstalled 5 workflows\n",
      source: `export const meta = { description: "d" };\n`,
      outcome: "refused",
      cause: "unsafe-name",
      escaped: "\\u{a}",
    },
    {
      threat: "a newline in the file name that reaches a skip",
      fileName: "ok.js\nInstalled 5 workflows\n",
      source: `return 42;\n`,
      outcome: "skipped",
      cause: "no-meta",
      escaped: "\\u{a}",
    },
    {
      // U+202E RIGHT-TO-LEFT OVERRIDE, written as an escape because it is
      // invisible and reverses the rendering of everything after it. It reaches
      // the message precisely BECAUSE the name was rejected and quoted back.
      threat: "a bidi override in the declared name, which reverses the rest of the line",
      fileName: "reporter.workflow.js",
      source: `export const meta = { name: "a\u202Eb/c" };\n`,
      outcome: "refused",
      cause: "unsafe-name",
      escaped: "\\u{202e}",
    },
    {
      // `\s` in the vendored blocklist matches a newline, so the matched text a
      // reason quotes back is attacker-chosen and can span lines.
      threat: "newlines inside the blocklist text that matched",
      fileName: "clock.js",
      source: `const stamped = new\n\n\nDate();\nexport const meta = { name: "ship" };\n`,
      outcome: "refused",
      cause: "determinism-code",
      escaped: "\\u{a}",
    },
  ] satisfies readonly UntrustedTextRow[]) {
    test(`escapes ${threat}`, () => {
      // arrange
      const expectedVerdict = { outcome, cause } satisfies NonAdmission;

      // act
      const verdict = admitWorkflowScript("acme", fileName, source);

      // assert
      assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
      assert.ok(verdict.outcome === "skipped" || verdict.outcome === "refused");
      assert.ok(verdict.reason.includes(escaped));
      // The whole reason, not just the interpolation under test: no control or
      // format character may survive anywhere in text `notify()` renders as-is.
      assert.doesNotMatch(verdict.reason, /[\p{Cc}\p{Cf}]/u);
    });
  }

  test("keeps the untrusted file name verbatim in the verdict's own data", () => {
    // arrange
    // Only the human-readable `reason` is escaped. `fileName` is the identity of
    // the file on disk, and a consumer that has to open it needs the real bytes.
    const fileName = "ok.js\nInstalled 5 workflows\n";
    const source = `export const meta = { name: "ship" };\n`;

    // act
    const verdict = admitWorkflowScript("acme", fileName, source);

    // assert
    assert.strictEqual(verdict.fileName, fileName);
  });

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

  // WGATE-01: one case per engine gate, per shape measured against
  // `@quintinshaw/pi-dynamic-workflows` 3.10.1. Every row asserts the gate NAME:
  // an assertion that "some gate is present" is green for the wrong gate, and
  // the gate a reader reports is the whole content of the warning.
  for (const { shape, source, outcome, gate } of [
    {
      shape: "declares a statement before its meta export",
      source: `const x = 1;\nexport const meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-first-export",
    },
    {
      shape: "never exports its meta at all",
      source: `const meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-first-export",
    },
    {
      shape: "exports a default before its meta",
      source: `export default 1;\nexport const meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-first-export",
    },
    {
      shape: "declares its meta with let",
      source: `export let meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-const-export",
    },
    {
      shape: "declares its meta with var",
      source: `export var meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-const-export",
    },
    {
      // The export's `declaration` is null here: a bare re-export declares
      // nothing, which is a distinct arm from `let` and `var`.
      shape: "re-exports its meta rather than declaring it in the export",
      source: `export { meta };\nconst meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-const-export",
    },
    {
      shape: "exports a function before its meta",
      source: `export function help() {}\nexport const meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-const-export",
    },
    {
      shape: "declares a second binding beside its meta",
      source: `export const meta = { name: "ship", description: "d" }, other = 1;\n`,
      outcome: "named",
      gate: "meta-not-sole-declarator",
    },
    {
      shape: "exports something other than meta first",
      source: `export const other = 1;\nconst meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-named-meta",
    },
    {
      shape: "spreads into a phases entry",
      source: `export const meta = { name: "ship", description: "d", phases: [{ title: "t", ...rest }] };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "spreads into meta before its name",
      source: `export const meta = { ...rest, name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "declares a method in meta",
      source: `export const meta = { name: "ship", description: "d", run() {} };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "declares an accessor in meta",
      source: `export const meta = { name: "ship", description: "d", get later() { return 1; } };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "declares a prototype key in meta",
      source: `export const meta = { name: "ship", description: "d", prototype: 1 };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "declares a constructor key in meta",
      source: `export const meta = { name: "ship", description: "d", constructor: 1 };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "declares a __proto__ key in meta",
      source: `export const meta = { name: "ship", description: "d", "__proto__": 1 };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      // The engine's `propertyKey` reads an identifier and a string- or
      // number-valued literal and refuses every other key node, so this key is
      // refused while the numeric key in the admitted rows below is not. A
      // predicate built from node type, `computed`, `kind` and `method` alone
      // lets this one through.
      shape: "declares a BigInt-literal key in meta",
      source: `export const meta = { name: "ship", description: "d", 1n: "x" };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "leaves a hole in its phases array",
      source: `export const meta = { name: "ship", description: "d", phases: [, { title: "t" }] };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "spreads into its phases array",
      source: `export const meta = { name: "ship", description: "d", phases: [...rest] };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "reads its model from a binding",
      source: `export const meta = { name: "ship", description: "d", model: someVar };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      // `undefined` is an identifier, so the engine refuses it as a non-literal
      // node before its `model` type check ever runs.
      shape: "declares its model as undefined",
      source: `export const meta = { name: "ship", description: "d", model: undefined };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "computes its model from an expression",
      source: `export const meta = { name: "ship", description: "d", model: 1 + 1 };\n`,
      outcome: "named",
      gate: "meta-not-pure-literal",
    },
    {
      // The one gate row whose verdict is NOT `named`: a substituted template
      // denies the script a readable name, so the stem names the command AND the
      // engine refuses the same value at its literal check.
      shape: "substitutes into its template-literal name",
      source: "export const meta = { name: `ship-${suffix}`, description: 'd' };\n",
      outcome: "stem-fallback",
      gate: "meta-not-pure-literal",
    },
    {
      shape: "declares no description",
      source: `export const meta = { name: "ship" };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares a whitespace-only description",
      source: `export const meta = { name: "ship", description: "   " };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares a numeric description",
      source: `export const meta = { name: "ship", description: 5 };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares a numeric model",
      source: `export const meta = { name: "ship", description: "d", model: 5 };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      // A negative-number unary IS resolvable, so this passes the literal check
      // and fails the field check -- the two are distinct rows on one value.
      shape: "declares a negative-number model",
      source: `export const meta = { name: "ship", description: "d", model: -1 };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares a null model",
      source: `export const meta = { name: "ship", description: "d", model: null };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares its phases as an object",
      source: `export const meta = { name: "ship", description: "d", phases: {} };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares a phases entry with no title",
      source: `export const meta = { name: "ship", description: "d", phases: [{}] };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares a phases entry with a numeric title",
      source: `export const meta = { name: "ship", description: "d", phases: [{ title: 1 }] };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares a phases entry that is not an object",
      source: `export const meta = { name: "ship", description: "d", phases: ["t"] };\n`,
      outcome: "named",
      gate: "meta-fields-invalid",
    },
    {
      shape: "declares nothing the engine refuses",
      source: `export const meta = { name: "ship", description: "d" };\n`,
      outcome: "named",
      gate: undefined,
    },
    {
      // The engine's `propertyKey` reads a numeric key to its text and admits
      // it, so firing here would warn about a script the engine loads.
      shape: "declares a numeric key in meta",
      source: `export const meta = { name: "ship", description: "d", 1: "x" };\n`,
      outcome: "named",
      gate: undefined,
    },
    {
      shape: "declares a quoted-string key in meta",
      source: `export const meta = { name: "ship", description: "d", "k-1": "x" };\n`,
      outcome: "named",
      gate: undefined,
    },
    {
      // The engine's literal arm returns the node's value with no type test, so
      // a regular expression resolves like any other literal.
      shape: "declares a regular-expression value in meta",
      source: `export const meta = { name: "ship", description: "d", pattern: /x/ };\n`,
      outcome: "named",
      gate: undefined,
    },
    {
      shape: "declares a substitution-free template description",
      source: "export const meta = { name: 'ship', description: `d` };\n",
      outcome: "named",
      gate: undefined,
    },
    {
      shape: "declares an empty phases array",
      source: `export const meta = { name: "ship", description: "d", phases: [] };\n`,
      outcome: "named",
      gate: undefined,
    },
    {
      shape: "nests literals inside meta",
      source: `export const meta = { name: "ship", description: "d", extra: { list: [1, "two", { deep: true }] } };\n`,
      outcome: "named",
      gate: undefined,
    },
    {
      shape: "declares a string model and a titled phase",
      source: `export const meta = { name: "ship", description: "d", model: "m", phases: [{ title: "t" }] };\n`,
      outcome: "named",
      gate: undefined,
    },
  ] satisfies readonly GateRow[]) {
    test(`reports ${gate ?? "no gate"} for a script that ${shape}`, () => {
      // arrange
      const expectedVerdict = { outcome, gate } satisfies GateReading;

      // act
      const verdict = admitWorkflowScript("acme", "ship.js", source);

      // assert
      assert.deepStrictEqual(gateReading(verdict), expectedVerdict);
    });
  }

  test("reports the gate the engine stops at, not the last one a script trips", () => {
    // arrange -- D-115-04: this script trips the FIRST-statement check AND
    // declares no description. The engine stops at the first, so it never
    // evaluates the object the field check describes. A reader that reported
    // every failing gate would pass every other row in this file.
    const source = `const x = 1;\nexport const meta = { name: "ship" };\n`;
    const expectedVerdict = {
      outcome: "named",
      gate: "meta-not-first-export",
    } satisfies GateReading;

    // act
    const verdict = admitWorkflowScript("acme", "ship.js", source);

    // assert
    assert.deepStrictEqual(gateReading(verdict), expectedVerdict);
  });

  test("refuses a meta declarator with no initializer as unparseable, with no gate of its own", () => {
    // arrange -- D-115-02: the engine carries a "declarator has an initializer"
    // check, and no parseable script can reach it. `export const meta;` is a
    // SyntaxError acorn rejects outright, and every non-const form is refused
    // one check earlier, so there is no seventh gate to name.
    const source = `export const meta;\n`;
    const expectedVerdict = { outcome: "refused", cause: "unparseable" } satisfies NonAdmission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.js", source);

    // assert
    assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
    assert.strictEqual(Object.hasOwn(verdict, "gate"), false);
  });

  test("leaves the gate field off a script the engine will load", () => {
    // arrange -- WGATE-03: absent, not present-and-undefined. The field is
    // spread in only when a gate fired, so a consumer reading it cannot tell an
    // unread gate from a passed one unless the key itself is missing.
    const source = `export const meta = { name: "ship", description: "d" };\n`;

    // act
    const verdict = admitWorkflowScript("acme", "ship.js", source);

    // assert
    assert.strictEqual(Object.hasOwn(verdict, "gate"), false);
  });

  for (const { shape, source } of [
    { shape: "a zero-byte script", source: "" },
    { shape: "a comment-only script", source: `// nothing to see here\n` },
  ] satisfies readonly { shape: string; source: string }[]) {
    test(`keeps ${shape} a no-meta skip carrying no gate`, () => {
      // arrange -- the parsed body is empty, so there is no meta to read gates
      // off and no admitted arm to carry one. A skip cannot hold a gate by type;
      // this pins that it does not hold one in fact either.
      const expectedVerdict = { outcome: "skipped", cause: "no-meta" } satisfies NonAdmission;

      // act
      const verdict = admitWorkflowScript("acme", "empty.js", source);

      // assert
      assert.deepStrictEqual(nonAdmission(verdict), expectedVerdict);
      assert.strictEqual(Object.hasOwn(verdict, "gate"), false);
    });
  }

  test("settles a meta object literal with zero properties as a stem fallback carrying the field gate", () => {
    // arrange -- the key set IS readable and simply declares nothing, which is
    // the stem fallback's own arm; the missing description is what the engine
    // refuses.
    const source = `export const meta = {};\n`;
    const expectedVerdict = {
      outcome: "stem-fallback",
      gate: "meta-fields-invalid",
    } satisfies GateReading;

    // act
    const verdict = admitWorkflowScript("acme", "ship.js", source);

    // assert
    assert.deepStrictEqual(gateReading(verdict), expectedVerdict);
  });

  test("gives a gate-warned script the same generated name as the same script without the gate", () => {
    // arrange -- WGATE-03 at the decision layer: a gate reading adds an advisory
    // field and changes nothing else about the verdict.
    const gated = `const x = 1;\nexport const meta = { name: "ship", description: "d" };\n`;
    const clean = `export const meta = { name: "ship", description: "d" };\n`;

    // act
    const gatedVerdict = admitWorkflowScript("acme", "ship.js", gated);
    const cleanVerdict = admitWorkflowScript("acme", "ship.js", clean);

    // assert
    assert.deepStrictEqual(admission(gatedVerdict), admission(cleanVerdict));
    assert.deepStrictEqual(gateReading(gatedVerdict), {
      outcome: "named",
      gate: "meta-not-first-export",
    } satisfies GateReading);
  });

  test("stops deciding rather than throwing when a meta literal nests past the walk budget", () => {
    // arrange -- WGATE-03: the gate walk recurses over untrusted AST, so it
    // carries a depth budget and its own containment. This literal hides a
    // spread the engine WOULD refuse under 40 levels of nesting, which acorn
    // parses without complaint. The budget stops the walk first, the containment
    // turns that into NO gate, and the cost is a missed warning rather than a
    // failed read. A reader without either would report the spread's gate here.
    const source = `export const meta = { name: "ship", description: "d", deep: ${"{ a: ".repeat(40)}{ ...rest }${" }".repeat(40)} };\n`;
    const expectedVerdict = {
      outcome: "named",
      metaName: "ship",
      generatedName: "acme:ship",
    } satisfies Admission;

    // act
    const verdict = admitWorkflowScript("acme", "ship.js", source);

    // assert
    assert.deepStrictEqual(admission(verdict), expectedVerdict);
    assert.strictEqual(Object.hasOwn(verdict, "gate"), false);
  });

  // WGATE-04: the refusal paths' REASON BYTES, pinned against the text the
  // reason builders produce today. "Unchanged" is only checkable against a
  // recorded baseline, so each row carries the whole sentence rather than a
  // substring or a pattern that would stay green through a rewrite.
  for (const { placement, source, cause, reason } of [
    {
      placement: "in executable code",
      source: `export const meta = { name: "ship", description: "d" };\nconst stamped = Date.now();\n`,
      cause: "determinism-code",
      reason: "clock.js calls `Date.now`, which the workflow engine refuses as nondeterministic",
    },
    {
      placement: "in a comment",
      source: `// resume safety: no Date.now anywhere\nexport const meta = { name: "ship", description: "d" };\n`,
      cause: "determinism-comment",
      reason:
        "clock.js mentions `Date.now` in a comment; the engine screens raw text and refuses the script anyway, so reword the comment to make it load",
    },
    {
      placement: "in a string literal",
      source: `const note = "Math.random is banned here";\nexport const meta = { name: "ship", description: "d" };\n`,
      cause: "determinism-string",
      reason:
        "clock.js mentions `Math.random` inside a string, template or regular-expression literal; the engine screens raw text and refuses the script anyway",
    },
    {
      // The matched text spans the comment's end, so the escaping form is part
      // of the pinned bytes: an unescaped newline here would forge a line in a
      // rendered warning block.
      placement: "across the comment-to-code boundary",
      source: `// trailing new\nDate();\nexport const meta = { name: "ship", description: "d" };\n`,
      cause: "determinism-split",
      reason:
        "clock.js matches `new\\u{a}Date()` across the boundary between quoted-or-commented text and code, so nothing is invoked; the engine screens raw text and refuses the script anyway, so the matching text must change to make it load",
    },
  ] satisfies readonly RefusalTextRow[]) {
    test(`WGATE-04: keeps the refusal reason for a blocklist match ${placement}`, () => {
      // arrange
      const expectedVerdict = { outcome: "refused", cause, reason } satisfies Refusal;

      // act
      const verdict = admitWorkflowScript("acme", "clock.js", source);

      // assert
      assert.deepStrictEqual(refusal(verdict), expectedVerdict);
    });
  }

  test("WGATE-04: refuses a script that is both unparseable and gate-tripping as unparseable alone", () => {
    // arrange -- an unbalanced brace after a statement that would trip the
    // first-statement check, over a meta declaring no description that would
    // trip the field check. There is no tree to read a gate off, so attaching
    // one would be inventing a finding; the absent field is also what fails if a
    // gate read is ever hoisted above this arm.
    const source = `const x = 1;\nexport const meta = { name: "ship"\n`;
    const expectedVerdict = {
      outcome: "refused",
      cause: "unparseable",
      reason: "broken.js is not parseable JavaScript, so no name can be read from it",
    } satisfies Refusal;

    // act
    const verdict = admitWorkflowScript("acme", "broken.js", source);

    // assert
    assert.deepStrictEqual(refusal(verdict), expectedVerdict);
    assert.strictEqual(Object.hasOwn(verdict, "gate"), false);
  });

  test("WGATE-04: refuses a script that is both nondeterministic and gate-tripping on the blocklist alone", () => {
    // arrange -- the timestamp is the first statement, so this script would trip
    // the first-statement check, and its meta declares no description, so it
    // would trip the field check too. The blocklist refusal is settled first and
    // carries no gate.
    const source = `const stamped = Date.now();\nexport const meta = { name: "ship" };\n`;
    const expectedVerdict = {
      outcome: "refused",
      cause: "determinism-code",
      reason: "clock.js calls `Date.now`, which the workflow engine refuses as nondeterministic",
    } satisfies Refusal;

    // act
    const verdict = admitWorkflowScript("acme", "clock.js", source);

    // assert
    assert.deepStrictEqual(refusal(verdict), expectedVerdict);
    assert.strictEqual(Object.hasOwn(verdict, "gate"), false);
  });

  test("WGATE-04: keeps the whole escaped refusal reason for a file name carrying a newline", () => {
    // arrange -- the escaping form is pinned as BYTES rather than as "contains an
    // escape": a rewrite that moved the escape, dropped the trailing one, or
    // switched notation would pass a substring check.
    const fileName = "ok.js\nInstalled 5 workflows\n";
    const source = `export const meta = { name: "ship"\n`;
    const expectedVerdict = {
      outcome: "refused",
      cause: "unparseable",
      reason:
        "ok.js\\u{a}Installed 5 workflows\\u{a} is not parseable JavaScript, so no name can be read from it",
    } satisfies Refusal;

    // act
    const verdict = admitWorkflowScript("acme", fileName, source);

    // assert
    assert.deepStrictEqual(refusal(verdict), expectedVerdict);
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
