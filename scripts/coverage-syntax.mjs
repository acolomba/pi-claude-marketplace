// The syntax primitives the coverage tooling shares (D-04): a fresh parse of
// executed JavaScript, a walk over every child node, the `\n`-only line model
// the producer and Istanbul count positions in, and the one definition of
// which spans a function declares. Name restoration and the independent
// correspondence both read declarations from here, so a function's `decl`
// and body spans mean the same thing in both.

import { parse } from "acorn";

const PARSE_OPTIONS = { ecmaVersion: "latest", sourceType: "module" };

/** A fresh AST of `executed`, parsed as an ES module. */
export function parseExecuted(executed) {
  return parse(executed, PARSE_OPTIONS);
}

function isNode(value) {
  return typeof value === "object" && value !== null && typeof value.type === "string";
}

/** Every AST node directly under `node`, in property order. */
export function* childNodes(node) {
  for (const [key, value] of Object.entries(node)) {
    if (key === "type") {
      continue;
    }

    if (Array.isArray(value)) {
      yield* value.filter(isNode);
    } else if (isNode(value)) {
      yield value;
    }
  }
}

/** The offset at which each line of `text` starts; lines break at `\n` only. */
export function lineStartsOf(text) {
  const starts = [0];

  for (let offset = 0; offset < text.length; offset += 1) {
    if (text[offset] === "\n") {
      starts.push(offset + 1);
    }
  }

  return starts;
}

/** The 1-based line and 0-based UTF-16 column of `offset`. */
export function locate(lineStarts, offset) {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >> 1;

    if (lineStarts[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return { line: low + 1, column: offset - lineStarts[low] };
}

// The identifier a method, accessor, constructor or property declares, when
// its key is a plain identifier; computed and literal keys declare none.
function keyName(node) {
  return node.computed || node.key.type !== "Identifier" ? undefined : node.key.name;
}

/**
 * The function `node` declares, if any: the `decl` offsets the producer
 * reports (the key of a method or property, the id of a function, or the
 * first character of an anonymous function or arrow), the body node, the
 * declared identifier name when there is one, and the outer node whose
 * offsets V8 reports. A method or property consumes its FunctionExpression
 * value through `consumed` so the value is not declared twice.
 */
export function declaredFunction(node, consumed) {
  if (
    (node.type === "MethodDefinition" || node.type === "Property") &&
    node.value?.type === "FunctionExpression"
  ) {
    consumed.add(node.value);
    return {
      decl: [node.key.start, node.key.end],
      body: node.value.body,
      name: keyName(node),
      outer: node,
    };
  }

  if (node.type === "ArrowFunctionExpression") {
    return { decl: [node.start, node.start + 1], body: node.body, name: undefined, outer: node };
  }

  if (
    (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
    !consumed.has(node)
  ) {
    const decl = node.id === null ? [node.start, node.start + 1] : [node.id.start, node.id.end];
    return { decl, body: node.body, name: node.id?.name, outer: node };
  }

  return undefined;
}
