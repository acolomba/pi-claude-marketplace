/**
 * Collapses absolute paths in diagnostic text to their basenames.
 *
 * Single-segment JSON pointers remain unchanged because a match requires an
 * internal separator after the absolute-path prefix.
 */
export function redactAbsolutePaths(text: string): string {
  const absolutePath = /(?:[A-Za-z]:[\\/]|\\\\\?\\|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;
  return text.replace(absolutePath, (match) => {
    const lastSeparator = Math.max(match.lastIndexOf("/"), match.lastIndexOf("\\"));
    return lastSeparator < 0 ? match : match.slice(lastSeparator + 1);
  });
}
