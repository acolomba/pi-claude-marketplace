import path from "node:path";

import ts from "typescript";

import { resolveCandidates } from "./check-unused-type-members.model.mjs";

/**
 * Directed value transfers for the unused-type-member gate.
 *
 * A consumer's read is credited back to a source member only where a value
 * actually moved: an argument reaching a resolved parameter, an initializer or
 * an assignment reaching a binding, a property of an object built here, a value
 * a body returned, a callback receiving what its caller supplied. Structural
 * compatibility is never a transfer, and every edge is one-way, so reading a
 * destination never vouches for a source that nothing was sent to.
 *
 * The walk is demand-driven and backward. Each read the model recorded asks one
 * question -- "which places could have supplied this value?" -- and the answer
 * is explored breadth first with a per-question memo, so the cost tracks read
 * sites rather than the product of every assignable pair of types.
 *
 * An edge carries the path the value was placed at, and following it backwards
 * consumes exactly that path. An argument placed at the element position of a
 * rest parameter answers a read of an element and nothing else, which is what
 * keeps a transfer from spreading sideways into unrelated slots.
 */

const analysedRoots = ["extensions/pi-claude-marketplace/", "tests/"];

// Written with a NUL so it can never collide with a key any source spells out.
const elementSegment = "\u0000element";

// A path this deep is a wrapper chain no reader follows by hand, and letting it
// grow is how a cycle turns into an unbounded family of distinct questions.
const deepestTrail = 8;

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

function isAnalysedPath(projectPath) {
  return analysedRoots.some((root) => projectPath.startsWith(root));
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
  const syntax = { variables: [], assignments: [], calls: [] };

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

function indexVariable(declaration, state) {
  const symbol = symbolOfName(declaration.name, state);

  if (declaration.initializer === undefined || symbol === undefined) {
    return;
  }

  pushInto(state.bySymbol, symbol, { node: declaration.initializer, at: [] }, state);
  recordTransfer(state, "initializer", declaration.initializer, declaration.name);
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
 * at its element position rather than whole.
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

function recordGap(state, property) {
  for (const candidate of resolveCandidates(state.checker, state.byDeclaration, property)) {
    const existing = state.unsupported.get(candidate.id);

    if (existing === undefined) {
      state.unsupported.set(candidate.id, ["erased-call-consumer"]);
      continue;
    }

    if (!existing.includes("erased-call-consumer")) {
      existing.push("erased-call-consumer");
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
      recordGap(state, property);
    }
  }
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

  const parameters = signatureTargetOf(call, state)?.parameters;

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
      addArgument(state, rest, argument, [elementSegment]);
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
  return segment === elementSegment
    ? checker.getIndexTypeOfType(type, ts.IndexKind.Number)
    : propertyTypeOf(type, segment, checker);
}

/**
 * The inventoried members a read of `key` would reach if the value sat at this
 * place under this path. The path is followed one segment at a time, so a place
 * whose shape diverges anywhere along it reaches nothing at all.
 */
function candidatesAt(node, trail, key, state) {
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
 * Follows an edge backwards. The edge says where in the destination the source
 * value was placed, so a trail that does not start with that path was never
 * carried by this edge, and the edge is simply not taken.
 */
function consume(trail, at) {
  if (at.length === 0) {
    return trail;
  }

  const matches =
    trail.length >= at.length && at.every((segment, index) => trail[index] === segment);
  return matches ? trail.slice(at.length) : undefined;
}

function continuations(sources, step) {
  const next = [];

  for (const source of sources ?? []) {
    const trail = consume(step.trail, source.at);

    if (trail !== undefined && trail.length <= deepestTrail) {
      next.push({ node: source.node, trail, transferred: true });
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

function collectReturns(node, found) {
  ts.forEachChild(node, (child) => {
    if (ts.isFunctionLike(child)) {
      return;
    }

    if (ts.isReturnStatement(child) && child.expression !== undefined) {
      found.push(whole(child.expression));
    }

    collectReturns(child, found);
  });
}

/**
 * The expressions a body hands back. Nested functions are left alone: their
 * returns belong to them, not to the body that encloses their declaration.
 */
function returnsOf(fn, state) {
  const known = state.returns.get(fn);

  if (known !== undefined) {
    return known;
  }

  const found = [];

  if (fn.body !== undefined) {
    if (ts.isBlock(fn.body)) {
      collectReturns(fn.body, found);
    } else {
      found.push(whole(fn.body));
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

function expandCall(call, step, state) {
  const sources = [];

  for (const target of targetsOf(call, state)) {
    sources.push(...returnsOf(target, state));
  }

  return continuations(sources, step);
}

function literalKeyOf(node) {
  if (ts.isStringLiteral(node)) {
    return node.text;
  }

  return ts.isNumericLiteral(node) ? elementSegment : undefined;
}

function expandElementAccess(node, step) {
  const segment = literalKeyOf(node.argumentExpression);
  return segment === undefined
    ? []
    : [{ node: node.expression, trail: [segment, ...step.trail], transferred: true }];
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

  return sources.map((source) => ({
    node: source.node,
    trail: source.spread ? step.trail : rest,
    transferred: true,
  }));
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
  return declaration.initializer === undefined
    ? []
    : continuations([whole(declaration.initializer)], step);
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

/** The expressions an expression's value could have come from. */
function expandValue(step, state) {
  const node = step.node;

  if (refinementKinds.has(node.kind)) {
    return continuations([whole(node.expression)], step);
  }

  if (ts.isPropertyAccessExpression(node)) {
    return [{ node: node.expression, trail: [node.name.text, ...step.trail], transferred: true }];
  }

  if (ts.isElementAccessExpression(node)) {
    return expandElementAccess(node, step);
  }

  if (ts.isObjectLiteralExpression(node)) {
    return expandObjectLiteral(node, step);
  }

  if (ts.isShorthandPropertyAssignment(node)) {
    return expandShorthand(node, step, state);
  }

  if (ts.isCallExpression(node)) {
    return expandCall(node, step, state);
  }

  return expandBranching(node, step);
}

function expandStep(step, state) {
  return expandPlace(step, state) ?? expandValue(step, state);
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
    returns: new Map(),
    transfers: [],
    witnesses: new Map(),
    unsupported: new Map(),
    credited: new Set(),
    counters: { steps: 0, edges: 0, reads: 0 },
    exhausted: undefined,
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
  const state = createState({ checker, projectRoot, byDeclaration, budget });
  indexTransfers(collectSyntax(program, state), state);

  for (const read of reads ?? []) {
    if (state.exhausted !== undefined) {
      break;
    }

    creditRead(read, state);
  }

  return {
    witnesses: state.witnesses,
    unsupported: state.unsupported,
    transfers: state.transfers,
    counters: state.counters,
    exhausted: state.exhausted,
  };
}
