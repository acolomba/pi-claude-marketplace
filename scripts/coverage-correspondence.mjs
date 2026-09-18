// The independent syntax correspondence of one Istanbul file record (D-03,
// D-04, D-09): a fresh inventory of every function, statement and branch the
// executed text declares, and the requirement that the record carries
// exactly those, each at its exact source span, and nothing else.
//
// The inventory is written from the syntax alone; it never reads the
// producer's output to decide what should exist. Counts, names and nearby
// positions play no part: two records are the same construct only when their
// spans are equal, so a dropped callback is missing even when a twin with the
// same name and the same hits sits next to it, and an invented record is
// unproven even when it overlaps a declared one.
//
// Coverage syntax model, version 1. Each row names an AST construct of the
// executed JavaScript and the Istanbul record it must correspond to, with the
// span the producer reports. Offsets are UTF-16 code units, lines are 1-based
// and counted at `\n` only, columns are 0-based and end columns exclusive.
//
//   Functions (`fnMap`, one record per construct, `decl` and `loc` exact):
//     FunctionDeclaration          decl = id, or its first character when
//                                  anonymous; loc = body
//     FunctionExpression           same, unless it is the value of a method
//                                  or property below
//     ArrowFunctionExpression      decl = first character; loc = body (a
//                                  block or the expression)
//     MethodDefinition             decl = key; loc = value body
//     Property with a
//       FunctionExpression value   decl = key; loc = value body
//
//   Statements (`statementMap`, one record per span):
//     Break, Continue, Debugger, Return, Throw, Try, For, ForIn, ForOf,
//     While, DoWhile, With, Labeled, If, Switch     the statement
//     ExpressionStatement          the statement, except a "use strict"
//                                  directive
//     VariableDeclarator           its initializer, when it has one
//     PropertyDefinition           its value, when it has one
//     ArrowFunctionExpression      its expression body, when not a block
//
//   Branches (`branchMap`, one record per construct, `type`, `loc` and
//   `locations` exact):
//     IfStatement                  if: [the statement, the alternate]; an
//                                  absent alternate is a location with no
//                                  coordinates (the implicit else)
//     ConditionalExpression        cond-expr: [consequent, alternate]
//     LogicalExpression            binary-expr: the operands of the whole
//                                  chain, nested logical operands flattened;
//                                  only the outermost expression of a chain
//                                  is a branch
//     SwitchStatement              switch: its cases, when it has any
//     AssignmentPattern            default-arg: [the default value]
//
// Coverage ignore hints are not part of the model: a record the syntax
// declares but a hint suppressed is missing, never excused. V8 also reports
// functions the source does not declare (the script itself, class member
// initializers); the inventory records each declared function's node offsets
// so a consumer can set those roots apart instead of counting them.

import {
  childNodes,
  declaredFunction,
  lineStartsOf,
  locate,
  parseExecuted,
} from "./coverage-syntax.mjs";

export const CORRESPONDENCE_SYNTAX_VERSION = 1;

const STATEMENT_TYPES = new Set([
  "BreakStatement",
  "ContinueStatement",
  "DebuggerStatement",
  "ReturnStatement",
  "ThrowStatement",
  "TryStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "WithStatement",
  "LabeledStatement",
  "IfStatement",
  "SwitchStatement",
]);

// The implicit else once serialized: positions with no coordinates.
const ABSENT_LOCATION = { start: {}, end: {} };

function locationOf(lineStarts, start, end) {
  return { start: locate(lineStarts, start), end: locate(lineStarts, end) };
}

function nodeLocation(lineStarts, node) {
  return locationOf(lineStarts, node.start, node.end);
}

function isUseStrict(statement) {
  return statement.expression.type === "Literal" && statement.expression.value === "use strict";
}

// The nodes whose spans a node contributes to the statement map.
function statementNodes(node) {
  if (STATEMENT_TYPES.has(node.type)) {
    return [node];
  }

  switch (node.type) {
    case "ExpressionStatement":
      return isUseStrict(node) ? [] : [node];
    case "VariableDeclarator":
      return node.init ? [node.init] : [];
    case "ClassBody":
      return node.body
        .filter((member) => member.type === "PropertyDefinition" && member.value)
        .map((member) => member.value);
    case "ArrowFunctionExpression":
      return node.body.type === "BlockStatement" ? [] : [node.body];
    default:
      return [];
  }
}

// The operands of a logical chain: every nested LogicalExpression is
// flattened into the outermost branch and marked so it declares no branch of
// its own.
function logicalOperands(node, skipped, operands) {
  if (node.type === "LogicalExpression") {
    skipped.add(node);
    logicalOperands(node.left, skipped, operands);
    logicalOperands(node.right, skipped, operands);
  } else {
    operands.push(node);
  }

  return operands;
}

function declaredBranch(node, skipped) {
  switch (node.type) {
    case "IfStatement":
      return { type: "if", locations: [node, node.alternate ?? null] };
    case "ConditionalExpression":
      return { type: "cond-expr", locations: [node.consequent, node.alternate] };
    case "LogicalExpression":
      return skipped.has(node)
        ? undefined
        : { type: "binary-expr", locations: logicalOperands(node, skipped, []) };
    case "SwitchStatement":
      return node.cases.length === 0 ? undefined : { type: "switch", locations: node.cases };
    case "AssignmentPattern":
      return { type: "default-arg", locations: [node.right] };
    default:
      return undefined;
  }
}

function locationKey(location) {
  const { start, end } = location ?? {};

  if (isAbsentPosition(start) && isAbsentPosition(end)) {
    return "absent";
  }

  return `${start?.line}:${start?.column}-${end?.line}:${end?.column}`;
}

function isAbsentPosition(position) {
  return (
    typeof position === "object" &&
    position !== null &&
    position.line === undefined &&
    position.column === undefined
  );
}

function functionKey(fn) {
  return `${locationKey(fn.decl)}|${locationKey(fn.loc)}`;
}

function statementKey(statement) {
  return locationKey(statement.loc);
}

function branchKey(branch) {
  return `${branch.type}|${locationKey(branch.loc)}|${branch.locations.map(locationKey).join(",")}`;
}

function collect(node, state) {
  const { lineStarts, inventory } = state;
  const fn = declaredFunction(node, state.consumed);

  if (fn !== undefined) {
    inventory.functions.push({
      decl: locationOf(lineStarts, fn.decl[0], fn.decl[1]),
      loc: nodeLocation(lineStarts, fn.body),
      offsets: { start: fn.outer.start, body: fn.body.start, end: fn.outer.end },
    });
  }

  for (const statement of statementNodes(node)) {
    inventory.statements.push({ loc: nodeLocation(lineStarts, statement) });
  }

  const branch = declaredBranch(node, state.skipped);

  if (branch !== undefined) {
    inventory.branches.push({
      type: branch.type,
      loc: nodeLocation(lineStarts, node),
      locations: branch.locations.map((location) =>
        location === null ? ABSENT_LOCATION : nodeLocation(lineStarts, location),
      ),
    });
  }

  for (const child of childNodes(node)) {
    collect(child, state);
  }
}

function distinct(entries, keyOf) {
  const seen = new Set();

  return entries.filter((entry) => {
    const key = keyOf(entry);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * Every function, statement and branch the executed text declares under the
 * syntax model above, in source order, from a fresh parse: `functions` as
 * `{ decl, loc, offsets }`, `statements` as `{ loc }` and `branches` as
 * `{ type, loc, locations }`, with `version` naming the model.
 */
export function syntaxInventory(executed) {
  const inventory = {
    version: CORRESPONDENCE_SYNTAX_VERSION,
    functions: [],
    statements: [],
    branches: [],
  };
  collect(parseExecuted(executed), {
    lineStarts: lineStartsOf(executed),
    consumed: new WeakSet(),
    skipped: new WeakSet(),
    inventory,
  });

  return {
    ...inventory,
    functions: distinct(inventory.functions, functionKey),
    statements: distinct(inventory.statements, statementKey),
    branches: distinct(inventory.branches, branchKey),
  };
}

/**
 * What the executed text `executed` is, once its types are gone: `type-only`
 * when the program has no statement at all, so nothing of it can execute and
 * an empty map is its faithful record, and `executable` otherwise, even when
 * the surviving statements (an import kept for its side effect, a re-export)
 * declare no function, statement or branch of the model. The counts are the
 * syntax inventory's, so a consumer can label a zero-execution record by what
 * it holds (D-04, D-07).
 */
export function classifySyntax(executed) {
  const inventory = syntaxInventory(executed);

  return {
    syntax: parseExecuted(executed).body.length === 0 ? "type-only" : "executable",
    functions: inventory.functions.length,
    statements: inventory.statements.length,
    branches: inventory.branches.length,
  };
}

// The rows for one record kind: a declared construct with no record is
// missing, one with several records is duplicated, and a record matching no
// declared construct is unproven. Identity is the exact key and nothing else.
function kindFailures(kind, declared, records, keyOf) {
  const idsByKey = new Map();

  for (const [id, record] of records) {
    const key = keyOf(record);
    idsByKey.set(key, [...(idsByKey.get(key) ?? []), id]);
  }

  const failures = [];
  const declaredKeys = new Set();

  for (const entry of declared) {
    const key = keyOf(entry);
    const ids = idsByKey.get(key);
    declaredKeys.add(key);

    if (ids === undefined) {
      failures.push({ kind: `${kind}-missing`, ...entry });
    } else if (ids.length > 1) {
      failures.push({ kind: `${kind}-duplicate`, ids, ...entry });
    }
  }

  for (const [id, record] of records) {
    if (!declaredKeys.has(keyOf(record))) {
      failures.push({ kind: `${kind}-unproven`, id, ...record });
    }
  }

  return failures;
}

function functionRecords(file) {
  return Object.entries(file.fnMap).map(([id, fn]) => [id, { decl: fn.decl, loc: fn.loc }]);
}

function statementRecords(file) {
  return Object.entries(file.statementMap).map(([id, loc]) => [id, { loc }]);
}

function branchRecords(file) {
  return Object.entries(file.branchMap).map(([id, branch]) => [
    id,
    { type: branch.type, loc: branch.loc, locations: branch.locations },
  ]);
}

/**
 * Every way the file record `file` differs from the syntax `executed`
 * declares: `function-missing`, `function-duplicate` and `function-unproven`
 * rows with the `decl` and `loc` in question, `statement-*` rows with the
 * `loc`, and `branch-*` rows with the `type`, `loc` and `locations`. An empty
 * answer means every declared construct has exactly one record at its exact
 * spans and every record is a declared construct.
 */
export function correspondenceFailures(file, executed) {
  const inventory = syntaxInventory(executed);
  const declaredFunctions = inventory.functions.map(({ decl, loc }) => ({ decl, loc }));

  return [
    ...kindFailures("function", declaredFunctions, functionRecords(file), functionKey),
    ...kindFailures("statement", inventory.statements, statementRecords(file), statementKey),
    ...kindFailures("branch", inventory.branches, branchRecords(file), branchKey),
  ];
}
