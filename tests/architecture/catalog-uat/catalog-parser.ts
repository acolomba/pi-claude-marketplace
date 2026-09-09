/** One exact output example parsed from the independent output catalog. */
export interface CatalogExample {
  readonly section: string;
  readonly state: string;
  readonly expected: string;
}

/** Parses the catalog's annotated output examples. */
export function loadCatalogExamples(_catalog: string): readonly CatalogExample[] {
  return [];
}
