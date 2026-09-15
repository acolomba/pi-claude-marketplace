import path from "node:path";

import ts from "typescript";

import { resolveCandidates } from "./check-unused-type-members.model.mjs";

/**
 * Directed value transfers for the unused-type-member gate.
 *
 * A consumer's read is credited back to a source member only where a value
 * actually moved: an argument reaching a resolved parameter, an initializer or
 * an assignment reaching a binding. Structural compatibility is never a
 * transfer, and every edge is one-way, so reading a destination never vouches
 * for a source that nothing was sent to.
 *
 * The walk is demand-driven and backward. Each read the model recorded asks one
 * question -- "which places could have supplied this value?" -- and the answer
 * is explored breadth first with a per-question memo, so the cost tracks read
 * sites rather than the product of every assignable pair of types.
 */

const analysedRoots = ["extensions/pi-claude-marketplace/", "tests/"];

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
      return false;
    }

    const node = stack.pop();
    visit(node);
    ts.forEachChild(node, (child) => {
      stack.push(child);
    });
  }

  return true;
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
 * Sorts every analysed source file's syntax into the three kinds of site that
 * can start a transfer. Declaration files and everything outside the production
 * and test roots contribute nothing: a value cannot move at a site that has no
 * body in this program.
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

function pushSource(map, key, source, state) {
  const existing = map.get(key);

  if (existing === undefined) {
    map.set(key, [source]);
  } else {
    existing.push(source);
  }

  state.counters.edges += 1;
}

function recordTransfer(state, kind, from, to) {
  state.transfers.push({ kind, from: siteOf(from, state), to: siteOf(to, state) });
}

function indexVariable(declaration, state) {
  if (declaration.initializer === undefined || !ts.isIdentifier(declaration.name)) {
    return;
  }

  const symbol = state.checker.getSymbolAtLocation(declaration.name);

  if (symbol === undefined) {
    return;
  }

  pushSource(state.bySymbol, symbol, { node: declaration.initializer, prefix: [] }, state);
  recordTransfer(state, "initializer", declaration.initializer, declaration.name);
}

function indexAssignment(assignment, state) {
  if (!ts.isIdentifier(assignment.left)) {
    return;
  }

  const symbol = state.checker.getSymbolAtLocation(assignment.left);

  if (symbol === undefined) {
    return;
  }

  pushSource(state.bySymbol, symbol, { node: assignment.right, prefix: [] }, state);
  recordTransfer(state, "assignment", assignment.right, assignment.left);
}

/**
 * The parameter an argument at this position reaches. A rest parameter collects
 * arguments into a new array rather than receiving one, so it is left to the
 * container semantics instead of being credited as a direct hand-off.
 */
function parameterAt(parameters, position) {
  const parameter = parameters[position];
  return parameter !== undefined && parameter.dotDotDotToken === undefined ? parameter : undefined;
}

/**
 * Connects a call's arguments to the parameters the checker resolved for it.
 * The checker decides which signature a call reaches, so an overload, a generic
 * instantiation and a method on an interface all land on the same edge kind.
 */
function indexCall(call, state) {
  const parameters = state.checker.getResolvedSignature(call)?.declaration?.parameters;

  if (parameters === undefined) {
    return;
  }

  (call.arguments ?? []).forEach((argument, position) => {
    const parameter = parameterAt(parameters, position);

    if (parameter === undefined) {
      return;
    }

    pushSource(state.byParameter, parameter, { node: argument, prefix: [] }, state);
    recordTransfer(state, "argument", argument, parameter.name);
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

/**
 * The inventoried members a read of `key` would reach if the value sat at this
 * place under this property path. The path is followed one property at a time,
 * so a place whose shape diverges anywhere along it reaches nothing at all.
 */
function candidatesAt(node, trail, key, state) {
  let type = state.checker.getTypeAtLocation(node);

  for (const segment of trail) {
    type = propertyTypeOf(type, segment, state.checker);

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

function continuations(sources, step) {
  return (sources ?? []).map((source) => ({
    node: source.node,
    trail: source.prefix.length === 0 ? step.trail : [...source.prefix, ...step.trail],
    transferred: true,
  }));
}

function expandIdentifier(node, step, state) {
  const symbol = state.checker.getSymbolAtLocation(node);

  if (symbol === undefined) {
    return [];
  }

  const sources = [...(state.bySymbol.get(symbol) ?? [])];

  for (const declaration of symbol.declarations ?? []) {
    if (ts.isParameter(declaration)) {
      sources.push(...(state.byParameter.get(declaration) ?? []));
    }
  }

  return continuations(sources, step);
}

function expandVariable(declaration, step) {
  return declaration.initializer === undefined
    ? []
    : continuations([{ node: declaration.initializer, prefix: [] }], step);
}

/** The places whose values could have arrived at this one. */
function expandStep(step, state) {
  const node = step.node;

  if (ts.isIdentifier(node)) {
    return expandIdentifier(node, step, state);
  }

  if (ts.isParameter(node)) {
    return continuations(state.byParameter.get(node), step);
  }

  if (ts.isVariableDeclaration(node)) {
    return expandVariable(node, step);
  }

  return [];
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
  const seen = new Set();
  const queue = [{ node: read.source, trail: read.path, transferred: false }];

  // Appending while iterating is what makes this breadth first: the array
  // iterator re-reads the length on every step, so a place discovered now is
  // visited after every place already queued.
  for (const step of queue) {
    if (!spend(state, read.site.path)) {
      return;
    }

    const token = `${idOf(step.node, state)}|${step.trail.join(" ")}`;

    if (seen.has(token)) {
      continue;
    }

    seen.add(token);

    if (step.transferred) {
      creditStep(read, step, state);
    }

    queue.push(...expandStep(step, state));
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
