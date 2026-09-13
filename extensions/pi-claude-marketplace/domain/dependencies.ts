// domain/dependencies.ts
//
// Stub awaiting implementation of the declared-dependency element parser.

/** One usable element of a plugin's `dependencies` array. */
export interface DeclaredDependency {
  readonly name: string;
  readonly version?: string;
  readonly marketplace?: string;
  readonly sha?: string;
}

export function parseDeclaredDependencies(_raw: unknown): readonly DeclaredDependency[] {
  return [];
}
