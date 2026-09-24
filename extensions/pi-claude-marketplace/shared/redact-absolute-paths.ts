/**
 * Collapses absolute paths in diagnostic text to their basenames.
 *
 * Single-segment JSON pointers remain unchanged because a match requires an
 * internal separator after the absolute-path prefix.
 *
 * WR-04: a match may not START immediately after a word character, a colon or
 * a separator, because a URL scheme satisfies both the drive-letter form
 * (`s:/` of `https://`) and the POSIX form (the slashes after it) -- so an
 * unanchored match turned `https://github.com/org/repo.git` into
 * `httprepo.git`, mangling a token that is not a local path at all. The same
 * anchor means a path embedded in a `file://` URL is left alone; nothing in
 * this extension composes one, and a mangled URL is worse for diagnosis than
 * an unredacted one.
 */
export function redactAbsolutePaths(text: string): string {
  const absolutePath = /(?<![\w:/\\])(?:[A-Za-z]:[\\/]|\\\\\?\\|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;
  return text.replace(absolutePath, (match) => {
    const lastSeparator = Math.max(match.lastIndexOf("/"), match.lastIndexOf("\\"));
    return lastSeparator < 0 ? match : match.slice(lastSeparator + 1);
  });
}
