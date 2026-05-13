/**
 * tests/helpers/prd-extract.ts -- reusable PRD §6.12 ES-5 extraction.
 *
 * Phase 1 introduces this so Phases 3 and 5 (which also assert marker text
 * against the PRD) don't reimplement the parse.
 *
 * Strategy: find the row starting with `| **ES-5** |`, then pull every
 * backtick-quoted substring from that row. Backticks survive `mdformat`
 * reflow because mdformat preserves literal markdown spans -- so the test
 * is stable across whitespace-only PRD edits (Pitfall #4 closure).
 */

export function extractEs5MarkerLiterals(prd: string): string[] {
  const es5RowRe = /^\|\s*\*\*ES-5\*\*\s*\|.*$/m;
  const es5RowMatch = es5RowRe.exec(prd);
  if (es5RowMatch === null) {
    throw new Error("PRD §6.12 ES-5 row not found -- has the PRD been refactored?");
  }

  const backtickRe = /`([^`]+)`/g;
  const literals: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(es5RowMatch[0])) !== null) {
    literals.push(m[1]!);
  }

  return literals;
}
