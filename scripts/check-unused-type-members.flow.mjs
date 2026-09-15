import path from "node:path";

import ts from "typescript";

import { resolveCandidates } from "./check-unused-type-members.model.mjs";
import {
  createOperationModel,
  readsOfOperand,
  restSummary,
  spreadSummary,
} from "./check-unused-type-members.operations.mjs";

/**
 * Directed value transfers for the unused-type-member gate.
 *
 * A consumer's read is credited back to a source member only where a value
 * actually moved: an argument reaching a resolved parameter, an initializer or
 * an assignment reaching a binding, a property of an object built here, a value
 * a body returned, a callback receiving what its caller supplied, an element
 * placed in a container. Structural compatibility is never a transfer, and every
 * edge is one-way, so reading a destination never vouches for a source that
 * nothing was sent to.
 *
 * The walk is demand-driven and backward. Each read the model recorded asks one
 * question -- "which places could have supplied this value?" -- and the answer
 * is explored breadth first with a per-question memo, so the cost tracks read
 * sites rather than the product of every assignable pair of types.
 *
 * An edge carries the path the value was placed at, and following it backwards
 * consumes exactly that path. A value placed at the second slot of a tuple
 * answers a read of that slot and nothing else, and a map value answers a read
 * through `get` while its key answers nothing at all.
 */

const analysedRoots = ["extensions/pi-claude-marketplace/", "tests/"];

// Synthetic path segments for positions a property name cannot spell. Each is
// written with a NUL so it can never collide with a key a source spells out.
const elementSegment = "\u0000element";
const awaitSegment = "\u0000await";
const mapValueSegment = "\u0000map-value";
const indexPrefix = "\u0000index:";

// A path this deep is a wrapper chain no reader follows by hand, and letting it
// grow is how a cycle turns into an unbounded family of distinct questions.
// Measured against this repository: raising the bound to six costs a fifth again
// in work and finds one more witness, so the reach that is left on the table is
// a documented limit rather than an unknown one. Stopping early under-credits,
// which produces a finding to investigate and never a member wrongly accepted.
const deepestTrail = 4;

const refinementKinds = new Set([
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.SatisfiesExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.TypeAssertionExpression,
]);

const joiningOperators = new Set([
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
]);

const mapNames = new Set(["Map", "WeakMap", "ReadonlyMap"]);

// Array methods whose result is built by a callback, whose result keeps the
// receiver's shape, and whose result is one element of the receiver.
const mappingMethods = new Set(["map", "flatMap"]);

// `sort`, `reverse` and `splice` return the receiver, or a run taken out of it,
// so their result holds the very elements the receiver already held.
const shapeKeepingMethods = new Set([
  "filter",
  "slice",
  "concat",
  "sort",
  "reverse",
  "splice",
  "toSorted",
  "toReversed",
]);
const pickingMethods = new Set(["find", "findLast", "at", "pop", "shift"]);
const arrayCallbackMethods = new Set([
  "map",
  "flatMap",
  "filter",
  "find",
  "findLast",
  "findIndex",
  "findLastIndex",
  "forEach",
  "some",
  "every",
  "sort",
]);

// A comparator is handed two elements, one per parameter; every other callback
// here receives the element at its first parameter only.
const comparatorMethods = new Set(["sort", "toSorted"]);

// Members that place a value into the receiver rather than take one out of it.
const elementWriteMethods = new Set(["push", "unshift", "fill"]);

// `entries` pairs each element with its position, so the element sits at the
// second slot of the pair and the first slot carries nothing.
const pairedMembers = new Set(["entries"]);

const arrayModeled = new Set([
  ...mappingMethods,
  ...shapeKeepingMethods,
  ...pickingMethods,
  ...arrayCallbackMethods,
  ...elementWriteMethods,
  ...pairedMembers,
  "flat",
]);
const promiseModeled = new Set(["then", "catch", "finally"]);
const mapModeled = new Set(["get", "set", "values", "forEach", "entries"]);

/**
 * Container members that move no member provenance at all: they answer a
 * question about the container rather than handing a value on. `join` and
 * `toString` do consume element values, but as serialisation rather than as a
 * transfer, so they belong to the operation summaries and not to this walk.
 */
const neutralMembers = new Set([
  "length",
  "size",
  "has",
  "delete",
  "clear",
  "includes",
  "indexOf",
  "lastIndexOf",
  "join",
  "toString",
  "keys",
]);

function isAnalysedPath(projectPath) {
  return analysedRoots.some((root) => projectPath.startsWith(root));
}

function indexSegment(position) {
  return `${indexPrefix}${position}`;
}

function indexPositionOf(segment) {
  return segment.startsWith(indexPrefix) ? Number(segment.slice(indexPrefix.length)) : undefined;
}

function isPositional(segment) {
  return segment === elementSegment || indexPositionOf(segment) !== undefined;
}

function projectPathOf(state, sourceFile) {
  const known = state.paths.get(sourceFile);

  if (known !== undefined) {
    return known;
  }

  const relative = path.relative(state.projectRoot, sourceFile.fileName).split(path.sep).join("/");
  state.paths.set(sourceFile, relative);
  return relative;
}

function siteOf(node, state) {
  const sourceFile = node.getSourceFile();
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return {
    path: projectPathOf(state, sourceFile),
    line: position.line + 1,
    column: position.character + 1,
  };
}

/** A stable per-node number, which is what makes the per-question memo cheap. */
function idOf(node, state) {
  const known = state.ids.get(node);

  if (known !== undefined) {
    return known;
  }

  state.nextId += 1;
  state.ids.set(node, state.nextId);
  return state.nextId;
}

function tokenOf(node, trail, state) {
  return `${idOf(node, state)}|${trail.join(" ")}`;
}

/**
 * Charges one unit of the transfer budget. Running out stops the walk and is
 * reported, never absorbed: a transfer graph that was cut short cannot say a
 * member is unread.
 */
function spend(state, where) {
  if (state.budget.remaining <= 0) {
    state.exhausted ??= { path: where, budget: state.budget.total };
    return false;
  }

  state.budget.remaining -= 1;
  state.counters.steps += 1;
  return true;
}

function walkNodes(root, state, where, visit) {
  const stack = [root];

  while (stack.length > 0) {
    if (!spend(state, where)) {
      return;
    }

    const node = stack.pop();
    visit(node);
    ts.forEachChild(node, (child) => {
      stack.push(child);
    });
  }
}

function sortNode(node, syntax) {
  if (ts.isVariableDeclaration(node)) {
    syntax.variables.push(node);
    return;
  }

  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    syntax.calls.push(node);
    return;
  }

  if (ts.isSpreadAssignment(node)) {
    syntax.spreads.push(node);
    return;
  }

  if (ts.isBindingElement(node) && node.dotDotDotToken !== undefined) {
    syntax.restBindings.push(node);
    return;
  }

  const assigning =
    ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;

  if (assigning) {
    syntax.assignments.push(node);
  }
}

/**
 * Sorts every analysed source file's syntax into the kinds of site that can
 * start a transfer. Declaration files and everything outside the production and
 * test roots contribute nothing: a value cannot move at a site that has no body
 * in this program.
 */
function collectSyntax(program, state) {
  const syntax = { variables: [], assignments: [], calls: [], spreads: [], restBindings: [] };

  for (const sourceFile of program.getSourceFiles()) {
    const projectPath = projectPathOf(state, sourceFile);

    if (sourceFile.isDeclarationFile || !isAnalysedPath(projectPath)) {
      continue;
    }

    walkNodes(sourceFile, state, projectPath, (node) => {
      sortNode(node, syntax);
    });

    if (state.exhausted !== undefined) {
      return syntax;
    }
  }

  return syntax;
}

function pushInto(map, key, value, state) {
  const existing = map.get(key);

  if (existing === undefined) {
    map.set(key, [value]);
  } else {
    existing.push(value);
  }

  state.counters.edges += 1;
}

function recordTransfer(state, kind, from, to) {
  state.transfers.push({ kind, from: siteOf(from, state), to: siteOf(to, state) });
}

function symbolOfName(nameNode, state) {
  return ts.isIdentifier(nameNode) ? state.checker.getSymbolAtLocation(nameNode) : undefined;
}

/** The expression a `for ... of` binding draws its elements from. */
function iteratedExpressionOf(declaration) {
  const statement = declaration.parent?.parent;
  return statement !== undefined && ts.isForOfStatement(statement)
    ? statement.expression
    : undefined;
}

function indexVariable(declaration, state) {
  const symbol = symbolOfName(declaration.name, state);

  if (symbol === undefined) {
    return;
  }

  if (declaration.initializer !== undefined) {
    pushInto(state.bySymbol, symbol, { node: declaration.initializer, at: [] }, state);
    recordTransfer(state, "initializer", declaration.initializer, declaration.name);
    return;
  }

  const iterated = iteratedExpressionOf(declaration);

  if (iterated !== undefined) {
    pushInto(state.bySymbol, symbol, { node: iterated, from: [elementSegment] }, state);
    recordTransfer(state, "iteration", iterated, declaration.name);
  }
}

function indexAssignment(assignment, state) {
  const symbol = symbolOfName(assignment.left, state);

  if (symbol === undefined) {
    return;
  }

  pushInto(state.bySymbol, symbol, { node: assignment.right, at: [] }, state);
  recordTransfer(state, "assignment", assignment.right, assignment.left);
}

function hasBody(node) {
  return ts.isFunctionLike(node) && node.body !== undefined;
}

function isAsync(node) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
  );
}

/**
 * The declaration whose body a call actually enters. An overload signature
 * declares a call shape but runs nothing, so the implementation the checker
 * merged it with is the place a value really arrives.
 */
function implementationOf(declaration, state) {
  if (declaration === undefined || hasBody(declaration)) {
    return declaration;
  }

  const symbol = declaration.name === undefined ? undefined : symbolOfName(declaration.name, state);
  const implementation = (symbol?.declarations ?? []).find((sibling) => hasBody(sibling));
  return implementation ?? declaration;
}

function signatureTargetOf(call, state) {
  if (state.targets.has(call)) {
    return state.targets.get(call);
  }

  const target = implementationOf(state.checker.getResolvedSignature(call)?.declaration, state);
  state.targets.set(call, target);
  return target;
}

function calleeSymbolOf(call, state) {
  const symbol = state.checker.getSymbolAtLocation(call.expression);

  if (symbol === undefined) {
    return undefined;
  }

  const merged = state.checker.getMergedSymbol(symbol);
  return (merged.flags & ts.SymbolFlags.Alias) === 0
    ? merged
    : state.checker.getAliasedSymbol(merged);
}

function isFunctionLiteral(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node);
}

/**
 * The function bodies an argument could hand over. An identifier is followed to
 * what was assigned to it, so a named handler is bound exactly like an inline
 * one, and a bare type annotation binds nothing at all.
 */
function functionLiteralsOf(node, state) {
  if (isFunctionLiteral(node)) {
    return [node];
  }

  const symbol = ts.isIdentifier(node) ? state.checker.getSymbolAtLocation(node) : undefined;

  if (symbol === undefined) {
    return [];
  }

  const found = (state.bySymbol.get(symbol) ?? [])
    .map((source) => source.node)
    .filter((candidate) => isFunctionLiteral(candidate));

  for (const declaration of symbol.declarations ?? []) {
    if (ts.isFunctionDeclaration(declaration) && declaration.body !== undefined) {
      found.push(declaration);
    }
  }

  return found;
}

/**
 * The parameter an argument at this position reaches directly. A rest parameter
 * collects arguments into a new array instead of receiving one, so it is bound
 * at the exact slot the argument lands in rather than whole.
 */
function parameterAt(parameters, position) {
  const parameter = parameters[position];
  return parameter !== undefined && parameter.dotDotDotToken === undefined ? parameter : undefined;
}

function restParameterOf(parameters) {
  const last = parameters[parameters.length - 1];
  return last !== undefined && last.dotDotDotToken !== undefined ? last : undefined;
}

/**
 * Records which function bodies were handed to which parameter. This is the
 * only thing that connects a callback's own parameters and results to the
 * places that feed and consume them, and it runs before argument binding so a
 * callback invoked in one file can be bound from another.
 */
function bindLiterals(call, state) {
  const parameters = signatureTargetOf(call, state)?.parameters;

  if (parameters === undefined) {
    return;
  }

  (call.arguments ?? []).forEach((argument, position) => {
    const parameter = parameterAt(parameters, position);
    const symbol = parameter === undefined ? undefined : symbolOfName(parameter.name, state);

    if (parameter === undefined || symbol === undefined) {
      return;
    }

    for (const literal of functionLiteralsOf(argument, state)) {
      pushInto(state.parametersByLiteral, literal, parameter, state);
      pushInto(state.literalsBySymbol, symbol, literal, state);
    }
  });
}

function addArgument(state, parameter, argument, at) {
  pushInto(state.byParameter, parameter, { node: argument, at }, state);
  recordTransfer(state, at.length === 0 ? "argument" : "rest-argument", argument, parameter.name);
}

function recordGap(state, property, reason) {
  for (const candidate of resolveCandidates(state.checker, state.byDeclaration, property)) {
    const existing = state.unsupported.get(candidate.id);

    if (existing === undefined) {
      state.unsupported.set(candidate.id, [reason]);
      continue;
    }

    if (!existing.includes(reason)) {
      existing.push(reason);
    }
  }
}

/**
 * Reports a call whose target this program cannot see. Its arguments could be
 * consumed anywhere, so every candidate they carry is an open question rather
 * than a member proven unread. The gap is bounded to those arguments' own
 * members: an opaque call condemns what it was handed, not the whole tree.
 */
function reportErasedCall(call, state) {
  for (const argument of call.arguments ?? []) {
    const type = state.checker.getTypeAtLocation(argument);

    for (const property of state.checker.getPropertiesOfType(type)) {
      recordGap(state, property, "erased-call-consumer");
    }
  }
}

function containerKindOf(type, checker) {
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    return "array";
  }

  const name = type.aliasSymbol?.name ?? type.symbol?.name;

  if (name === "Promise") {
    return "promise";
  }

  return name !== undefined && mapNames.has(name) ? "map" : undefined;
}

/**
 * The container a receiver expression names, memoised per node. Asking the
 * checker forces the receiver's type to be instantiated, which is the most
 * expensive question this walk asks, and every receiver is asked about twice:
 * once while indexing and once while tracing.
 */
function receiverKindOf(receiver, state) {
  if (state.kinds.has(receiver)) {
    return state.kinds.get(receiver);
  }

  const kind = containerKindOf(state.checker.getTypeAtLocation(receiver), state.checker);
  state.kinds.set(receiver, kind);
  return kind;
}

function elementTypeOf(type, position, checker) {
  if (position !== undefined && checker.isTupleType(type)) {
    return checker.getTypeArguments(type)[position];
  }

  return checker.getIndexTypeOfType(type, ts.IndexKind.Number);
}

function mapValueTypeOf(type, checker) {
  return containerKindOf(type, checker) === "map" ? checker.getTypeArguments(type)[1] : undefined;
}

function isModeledMember(kind, name) {
  if (kind === "map") {
    return mapModeled.has(name);
  }

  return kind === "promise" ? promiseModeled.has(name) : arrayModeled.has(name);
}

/**
 * Reports a container operation with no directed semantics here. The values it
 * could move are the receiver's elements or values, so those are the candidates
 * left unresolved -- an unmodeled operation is an open question, never a clean
 * verdict, and never a verdict about anything it did not touch.
 */
function reportUnmodeledMember(kind, name, receiver, state) {
  if (isModeledMember(kind, name) || neutralMembers.has(name)) {
    return;
  }

  const type = state.checker.getTypeAtLocation(receiver);
  const carried =
    kind === "map"
      ? mapValueTypeOf(type, state.checker)
      : elementTypeOf(type, undefined, state.checker);

  if (carried === undefined) {
    return;
  }

  for (const property of state.checker.getPropertiesOfType(carried)) {
    recordGap(state, property, "unmodeled-container-operation");
  }
}

/** The path a container hands to the first parameter of a callback it runs. */
function inwardSegmentOf(kind, name) {
  if (kind === "promise") {
    return name === "then" ? awaitSegment : undefined;
  }

  if (kind === "map") {
    return name === "forEach" ? mapValueSegment : undefined;
  }

  return arrayCallbackMethods.has(name) ? elementSegment : undefined;
}

function indexCallbackInput(call, receiver, segment, positions, state) {
  for (const argument of call.arguments ?? []) {
    for (const literal of functionLiteralsOf(argument, state)) {
      for (let position = 0; position < positions; position += 1) {
        const parameter = literal.parameters[position];

        if (parameter !== undefined) {
          pushInto(state.byParameter, parameter, { node: receiver, from: [segment] }, state);
          recordTransfer(state, "container-element", receiver, parameter.name);
        }
      }
    }
  }
}

/**
 * The binding a receiver expression names, and the keys selected along the way.
 * A value written into `report.rows` lands at an element of the `rows` key of
 * whatever `report` holds, which is the exact path a later read of that element
 * consumes.
 */
function placeOf(receiver, state) {
  const keys = [];
  let current = receiver;

  while (ts.isPropertyAccessExpression(current)) {
    keys.unshift(current.name.text);
    current = current.expression;
  }

  const symbol = symbolOfName(current, state);
  return symbol === undefined ? undefined : { symbol, keys };
}

/**
 * Indexes a member that places its arguments into the receiver. A spread
 * argument hands over its own elements rather than becoming one, so it answers
 * the receiver's element path directly instead of below it.
 */
function indexElementWrite(call, receiver, state) {
  const place = placeOf(receiver, state);

  if (place === undefined) {
    return;
  }

  for (const argument of call.arguments ?? []) {
    const spread = ts.isSpreadElement(argument);
    const node = spread ? argument.expression : argument;
    const at = spread ? place.keys : [...place.keys, elementSegment];
    pushInto(state.bySymbol, place.symbol, { node, at }, state);
    recordTransfer(state, "container-write", node, receiver);
  }
}

function indexMapSet(call, receiver, state) {
  const value = (call.arguments ?? [])[1];
  const place = placeOf(receiver, state);

  if (value === undefined || place === undefined) {
    return;
  }

  pushInto(
    state.bySymbol,
    place.symbol,
    { node: value, at: [...place.keys, mapValueSegment] },
    state,
  );
  recordTransfer(state, "map-value", value, receiver);
}

/**
 * Indexes the edges a container operation creates. Returns whether the call was
 * a container operation at all, because one that was must not also be treated
 * as an ordinary hand-off into a standard-library signature.
 */
function indexContainerCall(call, state) {
  const callee = call.expression;

  if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(callee)) {
    return false;
  }

  const receiver = callee.expression;
  const name = callee.name.text;
  const kind = receiverKindOf(receiver, state);

  if (kind === undefined) {
    return false;
  }

  const inward = inwardSegmentOf(kind, name);

  if (kind === "map" && name === "set") {
    indexMapSet(call, receiver, state);
  } else if (kind === "array" && elementWriteMethods.has(name)) {
    indexElementWrite(call, receiver, state);
  } else if (inward !== undefined) {
    indexCallbackInput(call, receiver, inward, comparatorMethods.has(name) ? 2 : 1, state);
  } else {
    reportUnmodeledMember(kind, name, receiver, state);
  }

  return true;
}

/**
 * Connects a call's arguments to the parameters the checker resolved for it.
 * The checker decides which signature a call reaches, so an overload, a generic
 * instantiation and a method on an interface all land on the same edge kind.
 */
function indexCall(call, state) {
  const symbol = calleeSymbolOf(call, state);

  if (symbol !== undefined) {
    pushInto(state.callsBySymbol, symbol, call, state);
  }

  const target = signatureTargetOf(call, state);

  // A call the checker resolved into a body in this program is never a
  // container operation, and asking whether it is would instantiate the
  // receiver's type for nothing. Most calls in a project are this one.
  if ((target === undefined || !hasBody(target)) && indexContainerCall(call, state)) {
    return;
  }

  const parameters = target?.parameters;

  if (parameters === undefined) {
    reportErasedCall(call, state);
    return;
  }

  const rest = restParameterOf(parameters);

  (call.arguments ?? []).forEach((argument, position) => {
    const direct = parameterAt(parameters, position);

    if (direct !== undefined) {
      addArgument(state, direct, argument, []);
      return;
    }

    if (rest !== undefined && position >= parameters.length - 1) {
      addArgument(state, rest, argument, [indexSegment(position - parameters.length + 1)]);
    }
  });
}

function indexTransfers(syntax, state) {
  for (const declaration of syntax.variables) {
    indexVariable(declaration, state);
  }

  for (const assignment of syntax.assignments) {
    indexAssignment(assignment, state);
  }

  for (const call of syntax.calls) {
    bindLiterals(call, state);
  }

  for (const call of syntax.calls) {
    indexCall(call, state);
  }
}

function propertyTypeOf(type, key, checker) {
  const symbol = checker.getPropertyOfType(type, key);
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  return symbol === undefined || declaration === undefined
    ? undefined
    : checker.getTypeOfSymbolAtLocation(symbol, declaration);
}

function segmentTypeOf(type, segment, checker) {
  if (segment === awaitSegment) {
    return checker.getAwaitedType(type);
  }

  if (segment === mapValueSegment) {
    return mapValueTypeOf(type, checker);
  }

  return isPositional(segment)
    ? elementTypeOf(type, indexPositionOf(segment), checker)
    : propertyTypeOf(type, segment, checker);
}

function resolveCandidatesAt(node, trail, key, state) {
  let type = state.checker.getTypeAtLocation(node);

  for (const segment of trail) {
    type = segmentTypeOf(type, segment, state.checker);

    if (type === undefined) {
      return [];
    }
  }

  const symbol = state.checker.getPropertyOfType(type, key);
  return symbol === undefined ? [] : resolveCandidates(state.checker, state.byDeclaration, symbol);
}

/**
 * The inventoried members a read of `key` would reach if the value sat at this
 * place under this path. The path is followed one segment at a time, so a place
 * whose shape diverges anywhere along it reaches nothing at all.
 *
 * The answer depends only on the place, the path and the key, never on which
 * read asked, so it is computed once. Walking a path instantiates types, which
 * is the most expensive thing this module does.
 */
function candidatesAt(node, trail, key, state) {
  const token = `${tokenOf(node, trail, state)}|${key}`;
  const known = state.resolved.get(token);

  if (known !== undefined) {
    return known;
  }

  const found = resolveCandidatesAt(node, trail, key, state);
  state.resolved.set(token, found);
  return found;
}

function pushWitness(state, candidate, read, source) {
  const witness = {
    path: read.site.path,
    line: read.site.line,
    column: read.site.column,
    kind: read.kind,
    origin: read.origin,
    syntax: "value-transfer",
    via: siteOf(source, state),
  };
  const existing = state.witnesses.get(candidate.id);

  if (existing === undefined) {
    state.witnesses.set(candidate.id, [witness]);
    return;
  }

  existing.push(witness);
}

/**
 * Credits the members this place supplies to the read being traced. A member
 * the read already proved on its own is skipped, and the nearest place that
 * supplies a member is the one that gets to name it, so one read leaves exactly
 * one witness per source member it reached.
 */
function creditStep(read, step, state) {
  for (const candidate of candidatesAt(step.node, step.trail, read.key, state)) {
    if (read.direct.includes(candidate) || state.credited.has(candidate.id)) {
      continue;
    }

    state.credited.add(candidate.id);
    pushWitness(state, candidate, read, step.node);
  }
}

/**
 * Whether one path segment answers a question about another. An exact position
 * and an unspecified element can answer each other; two different positions
 * never can, which is what keeps a tuple slot from inheriting its neighbour.
 */
function segmentsMatch(left, right) {
  if (left === right) {
    return true;
  }

  const positional = isPositional(left) && isPositional(right);
  return positional && (left === elementSegment || right === elementSegment);
}

/**
 * Follows an edge backwards.
 *
 * An edge states one of two things. `at` is where inside the destination this
 * source's value was placed, so the trail must start with that path and the
 * path is consumed. `from` is where inside the source the destination's whole
 * value came from, so the path is prepended instead. A rest argument lands at a
 * slot of its parameter; a loop binding is taken out of an element of the thing
 * it iterates. Those are opposite directions and must not share one rule.
 */
function advance(trail, source) {
  return source.from === undefined ? consume(trail, source.at ?? []) : [...source.from, ...trail];
}

function consume(trail, at) {
  if (at.length === 0) {
    return trail;
  }

  const matches =
    trail.length >= at.length && at.every((segment, index) => segmentsMatch(trail[index], segment));
  return matches ? trail.slice(at.length) : undefined;
}

function stepAt(node, trail) {
  return { node, trail, transferred: true };
}

function continuations(sources, step) {
  const next = [];

  for (const source of sources ?? []) {
    const trail = advance(step.trail, source);

    if (trail !== undefined && trail.length <= deepestTrail) {
      next.push(stepAt(source.node, trail));
    }
  }

  return next;
}

function whole(node) {
  return { node, at: [] };
}

/** Arguments reaching this position through calls to a parameter holding a body. */
function argumentsThrough(bound, position, state) {
  const symbol = symbolOfName(bound.name, state);
  const sources = [];

  for (const call of (symbol === undefined ? undefined : state.callsBySymbol.get(symbol)) ?? []) {
    const argument = (call.arguments ?? [])[position];

    if (argument !== undefined) {
      sources.push(whole(argument));
    }
  }

  return sources;
}

/**
 * Everything that could have arrived at this parameter: arguments written at a
 * call to its own function, plus arguments written at a call to whichever
 * parameter this function was handed to. The second half is what carries a
 * caller's value inward through a callback.
 */
function sourcesForParameter(parameter, state) {
  const position = parameter.parent.parameters.indexOf(parameter);
  const sources = [...(state.byParameter.get(parameter) ?? [])];

  for (const bound of state.parametersByLiteral.get(parameter.parent) ?? []) {
    sources.push(...argumentsThrough(bound, position, state));
  }

  return sources;
}

function sourcesOfSymbol(symbol, state) {
  const sources = [...(state.bySymbol.get(symbol) ?? [])];

  for (const declaration of symbol.declarations ?? []) {
    if (ts.isParameter(declaration)) {
      sources.push(...sourcesForParameter(declaration, state));
    }
  }

  return sources;
}

function collectReturns(node, at, found) {
  ts.forEachChild(node, (child) => {
    if (ts.isFunctionLike(child)) {
      return;
    }

    if (ts.isReturnStatement(child) && child.expression !== undefined) {
      found.push({ node: child.expression, at });
    }

    collectReturns(child, at, found);
  });
}

/**
 * The expressions a body hands back, and where in the call's result they land.
 * An async body hands back the fulfilled value, so its expressions sit at the
 * awaited position rather than at the result itself. Nested functions are left
 * alone: their returns belong to them, not to the body that encloses them.
 */
function returnsOf(fn, state) {
  const known = state.returns.get(fn);

  if (known !== undefined) {
    return known;
  }

  const at = isAsync(fn) ? [awaitSegment] : [];
  const found = [];

  if (fn.body !== undefined) {
    if (ts.isBlock(fn.body)) {
      collectReturns(fn.body, at, found);
    } else {
      found.push({ node: fn.body, at });
    }
  }

  state.returns.set(fn, found);
  return found;
}

/**
 * The bodies a call could run: the implementation the checker resolved, or, for
 * a call through a parameter, whichever bodies were handed to that parameter.
 * The second half is what carries a callback's result back outward.
 */
function targetsOf(call, state) {
  const target = signatureTargetOf(call, state);

  if (target !== undefined && hasBody(target)) {
    return [target];
  }

  const symbol = calleeSymbolOf(call, state);
  return symbol === undefined ? [] : (state.literalsBySymbol.get(symbol) ?? []);
}

function callbackReturns(call, rest, state) {
  const next = [];

  for (const argument of call.arguments ?? []) {
    for (const literal of functionLiteralsOf(argument, state)) {
      next.push(...continuations(returnsOf(literal, state), { trail: rest }));
    }
  }

  return next;
}

/**
 * An element of the receiver, reached through the pair `entries` builds. The
 * element sits at the pair's second slot, so a read of the first slot -- the
 * position -- reaches nothing, which is what keeps an index from inheriting the
 * members of the value beside it.
 */
function pairedElement(receiver, step) {
  const [outer, inner, ...rest] = step.trail;

  if (outer === undefined || !isPositional(outer) || inner === undefined) {
    return [];
  }

  return indexPositionOf(inner) === 1 ? [stepAt(receiver, [elementSegment, ...rest])] : [];
}

function arrayResult(name, receiver, call, step, state) {
  const [segment, ...rest] = step.trail;
  const positional = segment !== undefined && isPositional(segment);

  if (mappingMethods.has(name)) {
    return positional ? callbackReturns(call, rest, state) : [];
  }

  if (pairedMembers.has(name)) {
    return pairedElement(receiver, step);
  }

  if (name === "flat") {
    return positional ? [stepAt(receiver, [elementSegment, ...step.trail])] : [];
  }

  if (shapeKeepingMethods.has(name)) {
    const joined = name === "concat" ? call.arguments : [];
    return [stepAt(receiver, step.trail), ...joined.map((a) => stepAt(a, step.trail))];
  }

  return pickingMethods.has(name) ? [stepAt(receiver, [elementSegment, ...step.trail])] : [];
}

function promiseResult(name, receiver, call, step, state) {
  const [segment, ...rest] = step.trail;

  if (name === "then") {
    return segment === awaitSegment ? callbackReturns(call, rest, state) : [];
  }

  return name === "catch" || name === "finally" ? [stepAt(receiver, step.trail)] : [];
}

function mapResult(name, receiver, step) {
  if (name === "get") {
    return [stepAt(receiver, [mapValueSegment, ...step.trail])];
  }

  const [segment, inner, ...rest] = step.trail;
  const positional = segment !== undefined && isPositional(segment);

  if (pairedMembers.has(name)) {
    return positional && indexPositionOf(inner ?? "") === 1
      ? [stepAt(receiver, [mapValueSegment, ...rest])]
      : [];
  }

  return name === "values" && positional
    ? [
        stepAt(
          receiver,
          [mapValueSegment, inner, ...rest].filter((s) => s !== undefined),
        ),
      ]
    : [];
}

function promiseStatic(name, call, step) {
  const [segment, ...rest] = step.trail;

  if (name !== "resolve" || segment !== awaitSegment) {
    return [];
  }

  return (call.arguments ?? []).map((argument) => stepAt(argument, rest));
}

/**
 * Where a container operation's result came from, or `undefined` when the call
 * is not a container operation at all and the ordinary body-and-return rule
 * should answer instead.
 */
function expandContainerCall(call, step, state) {
  const callee = call.expression;

  if (!ts.isPropertyAccessExpression(callee)) {
    return undefined;
  }

  const receiver = callee.expression;
  const name = callee.name.text;

  if (ts.isIdentifier(receiver) && receiver.text === "Promise") {
    return promiseStatic(name, call, step);
  }

  const kind = receiverKindOf(receiver, state);

  if (kind === "map") {
    return mapResult(name, receiver, step);
  }

  if (kind === "promise") {
    return promiseResult(name, receiver, call, step, state);
  }

  return kind === "array" ? arrayResult(name, receiver, call, step, state) : undefined;
}

function expandCall(call, step, state) {
  const target = signatureTargetOf(call, state);

  if (target !== undefined && hasBody(target)) {
    return continuations(returnsOf(target, state), step);
  }

  const container = expandContainerCall(call, step, state);

  if (container !== undefined) {
    return container;
  }

  const sources = [];

  for (const body of targetsOf(call, state)) {
    sources.push(...returnsOf(body, state));
  }

  return continuations(sources, step);
}

function literalKeyOf(node) {
  if (ts.isStringLiteral(node)) {
    return node.text;
  }

  return ts.isNumericLiteral(node) ? indexSegment(Number(node.text)) : undefined;
}

function expandElementAccess(node, step) {
  const segment = literalKeyOf(node.argumentExpression);
  return segment === undefined ? [] : [stepAt(node.expression, [segment, ...step.trail])];
}

/**
 * An array built here supplies one slot from one expression. A spread keeps the
 * whole path, because it copies the source's own elements rather than naming a
 * slot of its own.
 */
function expandArrayLiteral(node, step) {
  const [segment, ...rest] = step.trail;

  if (segment === undefined || !isPositional(segment)) {
    return [];
  }

  const position = indexPositionOf(segment);
  const chosen = position === undefined ? [...node.elements] : [node.elements[position]];
  const next = [];

  for (const element of chosen) {
    if (element === undefined) {
      continue;
    }

    next.push(
      ts.isSpreadElement(element) ? stepAt(element.expression, step.trail) : stepAt(element, rest),
    );
  }

  return next;
}

function collectLiteralProperty(property, key, sources) {
  if (ts.isSpreadAssignment(property)) {
    sources.push({ node: property.expression, spread: true });
    return;
  }

  const name = property.name;

  if (name === undefined || !ts.isIdentifier(name) || name.text !== key) {
    return;
  }

  if (ts.isPropertyAssignment(property)) {
    sources.push({ node: property.initializer, spread: false });
    return;
  }

  if (ts.isShorthandPropertyAssignment(property)) {
    sources.push({ node: property, spread: false });
  }
}

/**
 * An object built here supplies one property from one expression. A spread
 * keeps the whole path, because it copies the source's own value at that key
 * rather than selecting one.
 */
function expandObjectLiteral(node, step) {
  const [key, ...rest] = step.trail;

  if (key === undefined) {
    return [];
  }

  const sources = [];

  for (const property of node.properties) {
    collectLiteralProperty(property, key, sources);
  }

  return sources.map((source) => stepAt(source.node, source.spread ? step.trail : rest));
}

function expandShorthand(node, step, state) {
  const symbol = state.checker.getShorthandAssignmentValueSymbol(node);
  return symbol === undefined ? [] : continuations(sourcesOfSymbol(symbol, state), step);
}

function expandIdentifier(node, step, state) {
  const symbol = state.checker.getSymbolAtLocation(node);
  return symbol === undefined ? [] : continuations(sourcesOfSymbol(symbol, state), step);
}

function expandVariable(declaration, step) {
  const iterated = iteratedExpressionOf(declaration);

  if (declaration.initializer !== undefined) {
    return continuations([whole(declaration.initializer)], step);
  }

  return iterated === undefined
    ? []
    : continuations([{ node: iterated, from: [elementSegment] }], step);
}

/** The places a binding could have been filled from. */
function expandPlace(step, state) {
  const node = step.node;

  if (ts.isIdentifier(node)) {
    return expandIdentifier(node, step, state);
  }

  if (ts.isParameter(node)) {
    return continuations(sourcesForParameter(node, state), step);
  }

  return ts.isVariableDeclaration(node) ? expandVariable(node, step) : undefined;
}

function expandBranching(node, step) {
  if (ts.isConditionalExpression(node)) {
    return continuations([whole(node.whenTrue), whole(node.whenFalse)], step);
  }

  if (!ts.isBinaryExpression(node)) {
    return [];
  }

  if (node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
    return continuations([whole(node.right)], step);
  }

  return joiningOperators.has(node.operatorToken.kind)
    ? continuations([whole(node.left), whole(node.right)], step)
    : [];
}

/** The expressions a built or awaited value could have come from. */
function expandComposite(step, state) {
  const node = step.node;

  if (ts.isObjectLiteralExpression(node)) {
    return expandObjectLiteral(node, step);
  }

  if (ts.isArrayLiteralExpression(node)) {
    return expandArrayLiteral(node, step);
  }

  if (ts.isAwaitExpression(node)) {
    return [stepAt(node.expression, [awaitSegment, ...step.trail])];
  }

  return ts.isShorthandPropertyAssignment(node) ? expandShorthand(node, step, state) : undefined;
}

/** The expressions an expression's value could have come from. */
function expandValue(step, state) {
  const node = step.node;

  if (refinementKinds.has(node.kind)) {
    return continuations([whole(node.expression)], step);
  }

  if (ts.isPropertyAccessExpression(node)) {
    return [stepAt(node.expression, [node.name.text, ...step.trail])];
  }

  if (ts.isElementAccessExpression(node)) {
    return expandElementAccess(node, step);
  }

  if (ts.isCallExpression(node)) {
    return expandCall(node, step, state);
  }

  return expandComposite(step, state) ?? expandBranching(node, step);
}

/**
 * Where a place's value could have come from. Like the member lookup above,
 * this depends only on the place and the path, so every read asking the same
 * question gets the same answer without re-deriving it.
 */
function expandStep(step, state) {
  const token = tokenOf(step.node, step.trail, state);
  const known = state.expansions.get(token);

  if (known !== undefined) {
    return known;
  }

  const next = (expandPlace(step, state) ?? expandValue(step, state)).filter(
    (candidate) => candidate.trail.length <= deepestTrail,
  );
  state.expansions.set(token, next);
  return next;
}

/**
 * Traces one recorded read back through the transfer graph.
 *
 * The queue is breadth first and every question is memoised, so a cycle in the
 * graph terminates on its second visit instead of recursing, and the shortest
 * path to a source member is the one recorded as its witness.
 */
function creditRead(read, state) {
  if (read.source === undefined) {
    return;
  }

  state.counters.reads += 1;
  state.credited = new Set();
  const seen = new Set([tokenOf(read.source, read.path, state)]);
  const queue = [{ node: read.source, trail: read.path, transferred: false }];

  // Appending while iterating is what makes this breadth first: the array
  // iterator re-reads the length on every step, so a place discovered now is
  // visited after every place already queued. A question is admitted to the
  // queue at most once, so a cycle closes instead of growing.
  for (const step of queue) {
    if (!spend(state, read.site.path)) {
      return;
    }

    if (step.transferred) {
      creditStep(read, step, state);
    }

    for (const next of expandStep(step, state)) {
      const token = tokenOf(next.node, next.trail, state);

      if (!seen.has(token)) {
        seen.add(token);
        queue.push(next);
      }
    }
  }
}

/**
 * Records the whole-object operations a run of calls carries out, and returns
 * the read sites they leave behind for the transfer walk to trace.
 *
 * The operand's own declared place is credited here, exactly as the model
 * credits the place a property access was written on. Everywhere the value came
 * from is credited by the walk, so a record built by a caller keeps its own
 * declaration even when the wrapper it passed through declares `unknown`.
 */
function collectOperationReads(syntax, state) {
  const reads = [];
  const summaries = [
    ...syntax.calls.map((call) => state.operations.summaryOfCall(call)),
    ...syntax.spreads.map((property) => spreadSummary(property)),
    ...syntax.restBindings.map((element) => restSummary(element)),
  ];

  for (const summary of summaries) {
    if (state.exhausted !== undefined) {
      return reads;
    }

    for (const operand of summary?.operands ?? []) {
      addOperationOperand(summary, operand, state, reads);
    }
  }

  return reads;
}

function originOf(node, state) {
  return projectPathOf(state, node.getSourceFile()).startsWith(analysedRoots[0])
    ? "production"
    : "test";
}

function pushOperationWitness(state, candidate, site, origin, syntax) {
  const witness = { ...site, kind: "value-read", origin, syntax };
  const existing = state.witnesses.get(candidate.id);

  if (existing === undefined) {
    state.witnesses.set(candidate.id, [witness]);
    return;
  }

  existing.push(witness);
}

/**
 * Reports an operation whose read keys this analysis cannot name. The members
 * at stake are the operand's own, so those are the candidates left unresolved
 * rather than credited.
 */
function reportOperationGap(operand, reason, state) {
  const type = state.checker.getTypeAtLocation(operand.node);

  for (const property of state.checker.getPropertiesOfType(type)) {
    recordGap(state, property, reason);
  }
}

function addOperationOperand(summary, operand, state, reads) {
  if (summary.gap !== undefined) {
    reportOperationGap(operand, summary.gap, state);
    return;
  }

  const found = readsOfOperand(summary, operand, state.checker, elementSegment);

  if (found.gap !== undefined) {
    reportOperationGap(operand, found.gap, state);
    return;
  }

  const site = siteOf(operand.node, state);
  const origin = originOf(operand.node, state);

  for (const place of found.reads) {
    if (!spend(state, site.path)) {
      return;
    }

    const direct = candidatesAt(operand.node, place.path, place.key, state);

    for (const candidate of direct) {
      pushOperationWitness(state, candidate, site, origin, summary.syntax);
    }

    state.counters.operationReads += 1;
    reads.push({
      source: operand.node,
      path: place.path,
      key: place.key,
      kind: "value-read",
      origin,
      site,
      direct,
    });
  }
}

function createState({ checker, projectRoot, byDeclaration, budget }) {
  return {
    checker,
    projectRoot,
    byDeclaration,
    budget: { remaining: budget, total: budget },
    paths: new Map(),
    ids: new WeakMap(),
    nextId: 0,
    bySymbol: new Map(),
    byParameter: new Map(),
    callsBySymbol: new Map(),
    literalsBySymbol: new Map(),
    parametersByLiteral: new Map(),
    targets: new Map(),
    kinds: new Map(),
    returns: new Map(),
    resolved: new Map(),
    expansions: new Map(),
    transfers: [],
    witnesses: new Map(),
    unsupported: new Map(),
    credited: new Set(),
    counters: { steps: 0, edges: 0, reads: 0, operationReads: 0, elapsedMs: 0 },
    exhausted: undefined,
    operations: undefined,
  };
}

/**
 * Credits every recorded read back to the members that actually supplied it.
 *
 * Returns transferred witnesses keyed by candidate id, the gaps the walk could
 * not close, the directed transfer records later stages read, the work this
 * walk did, and the budget exhaustion that stopped it, if one did.
 */
export function collectFlowObservations({
  program,
  checker,
  projectRoot,
  byDeclaration,
  reads,
  budget,
}) {
  const started = Date.now();
  const state = createState({ checker, projectRoot, byDeclaration, budget });
  state.operations = createOperationModel({
    checker,
    program,
    resolveTarget: (call) => signatureTargetOf(call, state),
    calleeSymbolOf: (call) => calleeSymbolOf(call, state),
  });
  const syntax = collectSyntax(program, state);
  indexTransfers(syntax, state);

  for (const read of [...(reads ?? []), ...collectOperationReads(syntax, state)]) {
    if (state.exhausted !== undefined) {
      break;
    }

    creditRead(read, state);
  }

  state.counters.elapsedMs = Date.now() - started;
  return {
    witnesses: state.witnesses,
    unsupported: state.unsupported,
    transfers: state.transfers,
    counters: state.counters,
    exhausted: state.exhausted,
  };
}
