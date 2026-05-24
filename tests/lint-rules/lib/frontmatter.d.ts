// tests/lint-rules/lib/frontmatter.d.ts
//
// Type declarations for the sibling `frontmatter.js` ESM loader. The loader
// is intentionally a `.js` file (test-infrastructure code consumed by
// ESLint, not the TypeScript compiler -- per RESEARCH.md Pattern 3 +
// Pitfall 2). The grammar-frontmatter drift test (`tests/architecture/
// grammar-frontmatter.test.ts`) imports the four named exports + the
// `parseStyleGuideFrontmatter` helper from this loader; these declarations
// provide the types `tsc --noEmit` needs to resolve those imports under
// the project's strict type-check.

export interface StyleGuideFrontmatter {
  readonly STATUS_TOKENS_FRONTMATTER: readonly string[];
  readonly REASONS_FRONTMATTER: readonly string[];
  readonly MARKERS_FRONTMATTER: readonly string[];
  readonly PATTERN_CLASSES_FRONTMATTER: readonly string[];
}

/**
 * Pure parser: takes the full style-guide markdown body and returns the
 * frozen 4-key frontmatter projection. Throws on any shape violation.
 */
export function parseStyleGuideFrontmatter(md: string): StyleGuideFrontmatter;

/**
 * Memoized loader: reads `docs/messaging-style-guide.md` once per Node
 * process and returns the frozen 4-key projection.
 */
export function loadFrontmatter(): StyleGuideFrontmatter;

export const STATUS_TOKENS_FRONTMATTER: readonly string[];
export const REASONS_FRONTMATTER: readonly string[];
export const MARKERS_FRONTMATTER: readonly string[];
export const PATTERN_CLASSES_FRONTMATTER: readonly string[];
