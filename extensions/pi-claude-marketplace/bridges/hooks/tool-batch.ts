import { requestedPath } from "./tool-input.ts";

export type NativeInput = Record<string, unknown>;

export interface EditPairView {
  readonly index: number;
  readonly input: Readonly<{
    file_path: string;
    old_string: string;
    new_string: string;
  }>;
}

export interface EditBatch {
  readonly original: NativeInput;
  readonly target: string;
  readonly pairs: readonly EditPairView[];
}

export type EditBatchDecision =
  | { readonly kind: "unchanged" }
  | { readonly kind: "block" }
  | { readonly kind: "original"; readonly category: "shape" | "field" | "value" }
  | { readonly kind: "accepted"; readonly input: NativeInput };

type PairProposal =
  | {
      readonly kind: "accepted";
      readonly target: string;
      readonly oldText: string;
      readonly newText: string;
    }
  | { readonly kind: "ignored"; readonly category: "shape" | "field" | "value" };

function decodePairProposal(value: unknown, cwd: string, home: string): PairProposal {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { kind: "ignored", category: "shape" };
  }

  const candidate = value as NativeInput;
  if (
    Object.keys(candidate).some(
      (key) => !["file_path", "old_string", "new_string", "replace_all"].includes(key),
    )
  ) {
    return { kind: "ignored", category: "field" };
  }

  if (
    typeof candidate.file_path !== "string" ||
    typeof candidate.old_string !== "string" ||
    typeof candidate.new_string !== "string" ||
    (candidate.replace_all !== undefined && candidate.replace_all !== false)
  ) {
    return { kind: "ignored", category: "value" };
  }

  try {
    return {
      kind: "accepted",
      target: requestedPath(candidate.file_path, cwd, home),
      oldText: candidate.old_string,
      newText: candidate.new_string,
    };
  } catch {
    return { kind: "ignored", category: "value" };
  }
}

/** Makes one immutable Claude view per valid native edit pair. */
export function editPairViews(input: unknown, cwd: string, home: string): EditBatch | undefined {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const original = input as NativeInput;
  if (
    typeof original.path !== "string" ||
    !Array.isArray(original.edits) ||
    original.edits.length === 0
  ) {
    return undefined;
  }

  const edits: unknown[] = original.edits;
  if (
    !edits.every(
      (pair) =>
        pair !== null &&
        typeof pair === "object" &&
        !Array.isArray(pair) &&
        typeof (pair as NativeInput).oldText === "string" &&
        typeof (pair as NativeInput).newText === "string",
    )
  ) {
    return undefined;
  }

  let target: string;
  try {
    target = requestedPath(original.path, cwd, home);
  } catch {
    return undefined;
  }

  const pairs = edits.map((pair, index) => {
    const edit = pair as { oldText: string; newText: string };
    return Object.freeze({
      index,
      input: Object.freeze({
        file_path: target,
        old_string: edit.oldText,
        new_string: edit.newText,
      }),
    });
  });
  return { original, target, pairs };
}

/** Chooses one native candidate only after every proposal has been inspected. */
export function decideEditBatch(
  batch: EditBatch,
  proposals: readonly (readonly unknown[])[],
  cwd: string,
  home: string,
): EditBatchDecision {
  const edits = (batch.original.edits as readonly NativeInput[]).map((edit) => ({ ...edit }));
  const targets: string[] = [];
  let category: "shape" | "field" | "value" | undefined;
  let changed = false;
  for (const view of batch.pairs) {
    let target = batch.target;
    const edit = edits[view.index] as NativeInput;
    for (const value of proposals[view.index] ?? []) {
      if (value === undefined) {
        continue;
      }

      const decoded = decodePairProposal(value, cwd, home);
      if (decoded.kind === "ignored") {
        category ??= decoded.category;
        continue;
      }

      target = decoded.target;
      edit.oldText = decoded.oldText;
      edit.newText = decoded.newText;
      changed = true;
    }

    targets.push(target);
  }

  if (targets.some((target) => target !== targets[0])) {
    return { kind: "block" };
  }

  if (category !== undefined) {
    return { kind: "original", category };
  }

  if (!changed) {
    return { kind: "unchanged" };
  }

  return { kind: "accepted", input: { ...batch.original, path: targets[0], edits } };
}
