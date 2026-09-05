// domain/workflow-project-key.ts
//
// WPTH-03: byte-identical reimplementation of the host workflow engine's
// private project-key derivation. The engine exposes no contract for it, so
// parity is held by a test carrying hard-coded expectations rather than by an
// import of a 0.x internal.
//
// The engine's source, transcribed so a future reader can diff it against an
// upgraded release without unpacking the tarball again:
//
//     export function workflowProjectKey(cwd) {
//         const projectPath = resolve(cwd);
//         const slug = sanitizePathSegment(basename(projectPath) || "project");
//         const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 12);
//         return `${slug}-${hash}`;
//     }
//     function sanitizePathSegment(value) {
//         const sanitized = value
//             .toLowerCase()
//             .replace(/[^a-z0-9._-]+/g, "-")
//             .replace(/^-+|-+$/g, "")
//             .slice(0, 48);
//         return sanitized || "project";
//     }
//
// Two orderings are load-bearing and easy to invert:
//
//   - The leading/trailing dash strip runs BEFORE the 48-character slice, so a
//     truncation can reintroduce a trailing dash that the strip already
//     removed. Inverting the two produces a different key for any name longer
//     than 48 characters whose 48th character is a dash.
//   - `resolve()` runs BEFORE `basename()`, so relative and non-normalized
//     spellings of one project (`relative/path`, `/a/../a/project`) collapse
//     onto a single key. Dropping `resolve()` still yields the right slug for
//     a relative path, so the slug alone does not witness this ordering -- the
//     hashed input does.
//
// The hash is a namespacing device, not a security boundary: it must match the
// engine byte-for-byte, so it takes no salt and no HMAC.

import { createHash } from "node:crypto";
import path from "node:path";

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48);

  return sanitized || "project";
}

/**
 * WPTH-03: the engine's per-project storage key for `cwd`, as
 * `<slug>-<12 hex>`.
 *
 * The slug's character class is `[a-z0-9._-]` with every other run collapsed
 * to one dash, the dash strip runs over the result, and an empty result falls
 * back to the literal `project`. A lone `.` and a `..` are therefore
 * unreachable outputs and no path separator can survive, which is what lets
 * `persistence/locations.ts` join this value under the workflow home without
 * an async containment check (NFR-10).
 */
export function workflowProjectKey(cwd: string): string {
  const projectPath = path.resolve(cwd);
  const slug = sanitizePathSegment(path.basename(projectPath) || "project");
  const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 12);

  return `${slug}-${hash}`;
}
