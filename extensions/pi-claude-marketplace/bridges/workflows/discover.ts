// bridges/workflows/discover.ts
//
// Bridge primitive: enumerate flat script files under each declared
// `componentPaths.workflows` entry (WBRG-02 -- non-recursive, ignore
// non-scripts), read each one, and hand it to `domain/workflow-script.ts` for
// a verdict. Returns a deterministic `DiscoveredWorkflow[]` -- every verdict
// arm, not just the admitted ones -- plus a `warnings[]` channel for WBRG-03
// soft-fails.
//
// The name comes from the script's own `meta.name`, so unlike the other
// component kinds discovery MUST read each candidate's body. Those bytes are
// carried forward on the record so `stage` does not re-read them, and so the
// read-only `info` surface can reuse the same pass.
//
// Symlink discipline (D-14): refuse symlinked script entries, in the same two
// layers the sibling bridges use (`shared/fs-utils.ts::isPlainMarkdownFile`),
// each of which refuses on its own. `readdir(withFileTypes)` answers
// `isFile() === false` for a symlink on every filesystem -- Node resolves a
// `UV_DIRENT_UNKNOWN` d_type through `lstat` before it constructs the `Dirent`
// -- so the dirent filter is what refuses the entry, and it runs first. The
// `lstat` under it re-asks the question against the live filesystem, covering
// an entry swapped for a link after the `readdir` snapshot was taken. Neither
// layer opens the file, so a link pointing outside the plugin root never has
// its contents copied into an envelope.
//
// NFR-10 on the READ side: every declared workflows directory is re-checked
// against the plugin root here, not assumed of the caller. The resolver does
// gate the paths it publishes, but it is not the only producer -- the
// read-only `info` surface re-derives component paths for the arm the resolver
// could not resolve, from raw manifest strings. This bridge reads file BODIES
// and renders strings taken out of them, so an uncontained directory is a
// disclosure of arbitrary file contents rather than a listing of names.

import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { admitWorkflowScript, WORKFLOW_SCRIPT_EXTENSIONS } from "../../domain/workflow-script.ts";
import { errorMessage } from "../../shared/errors.ts";
import { readDirEntriesTolerant } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type {
  DiscoveredWorkflow,
  DiscoverPluginWorkflowsResult,
  WorkflowDiscoveryTarget,
  WorkflowOutcomeSite,
  WorkflowOutcomeTense,
} from "./types.ts";
import type { WorkflowGate, WorkflowVerdict } from "../../domain/workflow-script.ts";
import type { Dirent } from "node:fs";

/**
 * WBRG-02: the suffix test runs against the LOWERCASED entry name, because a
 * case-insensitive filesystem reports `Thing.JS` as stored and the stem rule
 * in `domain/workflow-script.ts` strips its suffix the same way. The filter and
 * the stem rule must admit the same set, or a file the filter admits keeps its
 * suffix inside the command name.
 *
 * Dotfiles, directories, symlinks and non-script suffixes are all excluded by
 * the dirent filter, before the `lstat`, so the scan stays flat and reads
 * nothing it will not decide. The `lstat` re-asks the symlink question against
 * the live filesystem rather than the `readdir` snapshot -- see the module
 * header for why both layers are here.
 *
 * WBRG-03: the `lstat` rides the same per-file soft-fail channel as the
 * `readFile` below it. Both IO calls land on the same file one step apart, so
 * opposite failure policies would mean an EACCES decided the whole plugin's
 * fate or one file's, depending only on which call reached the file first.
 */
async function isWorkflowScriptFile(
  dir: string,
  entry: Dirent,
): Promise<{ ok: true; admit: boolean } | { ok: false; reason: string }> {
  const lowered = entry.name.toLowerCase();

  if (
    entry.name.startsWith(".") ||
    !entry.isFile() ||
    !WORKFLOW_SCRIPT_EXTENSIONS.some((ext) => lowered.endsWith(ext))
  ) {
    return { ok: true, admit: false };
  }

  try {
    const stat = await lstat(path.join(dir, entry.name));
    return { ok: true, admit: !stat.isSymbolicLink() };
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }
}

/**
 * WBRG-03: the one message shape every per-file soft-fail wears. Each warning
 * names the FILE and the containing DIRECTORY, so a user reading it can find
 * the script without cross-referencing anything, and then renders the reason
 * it was handed rather than composing a new one.
 */
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  return `workflow script "${fileName}" in "${workflowsDir}" ${outcome}: ${reason}`;
}

/**
 * WR-09: what the `install` surface says happened, one phrase per site.
 *
 * Total over the site union, which is the forcing construct: a further site
 * cannot be composed without an entry here AND in the preview table below, so
 * the two tenses cannot drift apart by omission.
 *
 * WGATE-01: the `gate` phrase states the admitted fact BEFORE its caveat, the
 * way `stem-fallback` does, because the envelope is written and the command is
 * registered. A phrase shaped like the three soft-fails would report a disposal
 * that did not happen.
 */
const INSTALL_OUTCOMES: Record<WorkflowOutcomeSite, string> = {
  skipped: "was not installed",
  refused: "was refused",
  "stem-fallback": "was installed but will not run",
  read: "could not be read and was skipped",
  inspect: "could not be inspected and was skipped",
  gate: "was installed but the engine will refuse to load it",
};

/**
 * WR-09: what the read-only `info` surface says WOULD happen, paired 1:1 with
 * the install phrases above so a reader meeting the same condition on both
 * surfaces recognizes it.
 *
 * The preview phrases state no skip, because a preview skips nothing: the
 * install-tense phrases each name a disposal ("and was skipped") that the
 * read-only pass did not carry out.
 */
const PREVIEW_OUTCOMES: Record<WorkflowOutcomeSite, string> = {
  skipped: "will not be installed",
  refused: "will be refused",
  "stem-fallback": "would be installed but will not run",
  read: "could not be read",
  inspect: "could not be inspected",
  gate: "would be installed but the engine will refuse to load it",
};

/**
 * WGATE-01: one literal sentence per engine gate, opening with the engine's own
 * check NUMBER so a reader can cross-reference the numbered table in
 * `docs/workflows-compatibility.md`, then stating the rule.
 *
 * The explicit `Record<WorkflowGate, string>` annotation is the bridge-side
 * totality lock: a new gate in the domain union cannot compile without a
 * sentence here.
 *
 * No value interpolates ANY script-derived text -- not a file name, not a key
 * name, not a node type read out of the parsed source. Naming the gate rather
 * than the offending token is what keeps this line free of the newline-forgery
 * and bidi-override hazards `forMessage` exists for, and it is also the more
 * useful sentence: the author needs the rule, which they can act on, rather than
 * a token they already wrote.
 */
const GATE_REASONS: Record<WorkflowGate, string> = {
  "meta-not-first-export":
    "the engine refuses at its check 3 -- `export const meta = ...` must be the first statement in the script",
  "meta-not-const-export":
    "the engine refuses at its check 4 -- the first export must be a `const` variable declaration",
  "meta-not-sole-declarator":
    "the engine refuses at its check 5 -- that export must declare `meta` and nothing else",
  "meta-not-named-meta":
    "the engine refuses at its check 6 -- the declared identifier must be `meta`",
  "meta-not-pure-literal":
    "the engine refuses at its check 8 -- every value inside `meta` must be a plain literal, so no spread, computed key, method, accessor, reserved key name (`__proto__`, `constructor`, `prototype`), array hole, substituted template or computed expression",
  "meta-fields-invalid":
    "the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared",
};

function outcomePhrase(tense: WorkflowOutcomeTense, site: WorkflowOutcomeSite): string {
  return tense === "install" ? INSTALL_OUTCOMES[site] : PREVIEW_OUTCOMES[site];
}

/**
 * WBRG-03 / WR-09: an IO failure on one candidate, attributed to the call site
 * that raised it.
 *
 * `inspect` and `read` land on the same file one step apart, so each site
 * states its own phrase: nothing has been opened when the `lstat` fails, so
 * only the `read` site may claim a read.
 */
function readFailureWarning(
  fileName: string,
  workflowsDir: string,
  reason: string,
  tense: WorkflowOutcomeTense,
  site: Extract<WorkflowOutcomeSite, "read" | "inspect">,
): string {
  return softFailWarning(fileName, workflowsDir, outcomePhrase(tense, site), reason);
}

/**
 * The key the source-path dedup below compares on, case-folded where the
 * platform's default filesystem is case-insensitive.
 *
 * A manifest may declare `workflows` and `Workflows`; on macOS those name ONE
 * directory but produce two distinct strings. Comparing the raw strings there
 * would discover every script in it twice, and two records for one script
 * collide on their generated name -- failing the install of a well-formed
 * plugin, which is the exact outcome the path dedup exists to prevent.
 */
function pathDedupKey(full: string): string {
  return process.platform === "darwin" || process.platform === "win32" ? full.toLowerCase() : full;
}

/**
 * Read one script's source, or the reason it could not be read.
 *
 * WBRG-01: the envelope carries the script bytes verbatim, so a decode that
 * SILENTLY edits them is a broken promise rather than a lenient read.
 * `readFile(..., "utf8")` substitutes U+FFFD for every invalid byte sequence,
 * which would install a mutated copy of executable third-party code that still
 * looks like a faithful one. The round-trip comparison is what makes the
 * verbatim claim true; a file that fails it is a per-file soft-fail (WBRG-03),
 * not a whole-plugin failure.
 */
async function readScriptSource(
  full: string,
): Promise<{ ok: true; source: string } | { ok: false; reason: string }> {
  let raw: Buffer;

  try {
    raw = await readFile(full);
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }

  const source = raw.toString("utf8");

  if (!Buffer.from(source, "utf8").equals(raw)) {
    return {
      ok: false,
      reason: "the file is not valid UTF-8, so its bytes cannot be copied verbatim",
    };
  }

  return { ok: true, source };
}

/**
 * WVAL-02: the one outcome phrase that states an ADMITTED fact before its
 * caveat. The envelope IS written, so a phrase shaped like the three soft-fails
 * above would report a refusal that did not happen.
 *
 * The reason names the missing NAME and states the description as the OTHER
 * requirement the engine imposes, never as a second observed absence: a
 * stem-fallback verdict carries a description whenever the `meta` object
 * declares one, so claiming it absent would make the row a false statement
 * about the file.
 */
function unrunnableWarning(
  fileName: string,
  workflowsDir: string,
  tense: WorkflowOutcomeTense,
  gate: WorkflowGate | undefined,
): string {
  return softFailWarning(
    fileName,
    workflowsDir,
    outcomePhrase(tense, "stem-fallback"),
    "the engine loads a command only from a literal `meta.name` with a non-empty " +
      "`meta.description`, and this script declares no readable name" +
      // WGATE-01: ONE LINE PER FILE. A stem-fallback script that also trips a
      // gate has both facts named inside this one reason, because a second line
      // would say the same thing about the same file in different words, which
      // is what makes a warning channel ignorable.
      (gate === undefined ? "" : `; ${GATE_REASONS[gate]}`),
  );
}

/**
 * WGATE-01: the engine gate an ADMITTED script would be refused at, as its own
 * line. Composed through the one `softFailWarning` shape every per-file line
 * wears, so this line is scannable beside the soft-fails rather than a second
 * format to learn.
 */
function gateWarning(
  fileName: string,
  workflowsDir: string,
  tense: WorkflowOutcomeTense,
  gate: WorkflowGate,
): string {
  return softFailWarning(fileName, workflowsDir, outcomePhrase(tense, "gate"), GATE_REASONS[gate]);
}

/**
 * WBRG-03 / WVAL-03 / WGATE-01: the warning a verdict earns, or `undefined` for
 * a `named` verdict the host engine will load.
 *
 * The `stem-fallback` arm earns a row despite being admitted, because every
 * shape reaching it names a command the engine will refuse to load: WNAM-02
 * falls back to the file stem precisely when no literal `meta.name` was
 * readable, and the engine's own metadata validation admits nothing else. The
 * `named` arm earns one when the script carries a gate, which is the same fact
 * about a script whose name WAS readable. The envelope is still written and the
 * record still returned either way, so both rows are caveats rather than
 * refusals.
 *
 * The verdict's own `reason` is rendered verbatim and never paraphrased. The
 * decision layer is where a raw-text match is attributed to code, to a comment
 * or to a literal, and restating that here would reintroduce the misattribution
 * it exists to remove -- a mention reported as a call claims a rule the script
 * did not violate.
 */
function verdictWarning(
  verdict: WorkflowVerdict,
  workflowsDir: string,
  tense: WorkflowOutcomeTense,
): string | undefined {
  if (verdict.outcome === "skipped" || verdict.outcome === "refused") {
    return softFailWarning(
      verdict.fileName,
      workflowsDir,
      outcomePhrase(tense, verdict.outcome),
      verdict.reason,
    );
  }

  if (verdict.outcome === "stem-fallback") {
    return unrunnableWarning(verdict.fileName, workflowsDir, tense, verdict.gate);
  }

  if (verdict.gate === undefined) {
    return undefined;
  }

  return gateWarning(verdict.fileName, workflowsDir, tense, verdict.gate);
}

/**
 * WBRG-02 / WBRG-03: walk every declared workflows directory, decide each
 * script, and return the FULL verdict array.
 *
 * Three deliberate divergences from the commands analog:
 *
 * 1. `assertSafeName` is NOT called on the discovered file name.
 *    `admitWorkflowScript` routes an unsafe declared name into a per-file
 *    `refused` verdict, so asserting here would turn one badly named script
 *    into a whole-plugin install failure.
 * 2. Each surviving candidate is read, because the name lives in `meta.name`.
 *    A read failure is a `warnings[]` entry naming the file, never a throw --
 *    one unreadable script must not block the rest of the plugin. The skipped
 *    and refused verdicts earn a warning on the same terms: a helper module, a
 *    broken draft and a script the engine's raw-text gate rejects are each one
 *    file's defect, and the plugin still installs everything else.
 * 3. There is NO dedup by generated name anywhere. Two scripts sharing a
 *    generated name is a WNAM-05 collision, a defect of the SET, and
 *    `assertNoWorkflowNameCollisions` must see both records to report both
 *    file names. Dropping the second here would make that assert unreachable
 *    and silently install the first under a name the author gave to two
 *    scripts.
 *
 * The one dedup that DOES run here is by absolute source path, and it is not a
 * name rule: the resolver dedups its component paths by the raw declared
 * string, so a manifest declaring `"./workflows"` alongside the conventional
 * `workflows` directory yields two entries naming ONE directory. Without this
 * guard every file in it would be discovered twice and collide with itself,
 * failing a well-formed plugin. Identical paths are silently collapsed rather
 * than warned about, because nothing is wrong with such a manifest. See
 * `pathDedupKey` for why the comparison is case-folded on some platforms.
 */
export async function discoverPluginWorkflows(input: {
  pluginName: string;
  resolved: WorkflowDiscoveryTarget;
  /**
   * WR-09: REQUIRED, deliberately. An optional tense defaulting to `install`
   * would let a read-only caller inherit the staging surface's wording by
   * saying nothing, which is the defect this parameter exists to remove.
   */
  tense: WorkflowOutcomeTense;
}): Promise<DiscoverPluginWorkflowsResult> {
  const discovered: DiscoveredWorkflow[] = [];
  const warnings: string[] = [];
  // Shared across directories, because the same directory can be declared
  // twice under two spellings -- see the path-dedup note above.
  const seenPaths = new Set<string>();

  for (const workflowsRel of input.resolved.componentPaths.workflows) {
    const workflowsDir = path.resolve(input.resolved.pluginRoot, workflowsRel);
    // NFR-10: `path.resolve` honors an absolute declared path outright, so the
    // containment check is what makes a declared `/etc` a refusal rather than
    // a walk. Loud by design (PathContainmentError) -- a declared path that
    // escapes the plugin root is a defect of the manifest, not of one file.
    await assertPathInside(
      input.resolved.pluginRoot,
      workflowsDir,
      `workflows component path "${workflowsRel}"`,
    );

    const scan = await scanWorkflowsDirectory({
      pluginName: input.pluginName,
      workflowsDir,
      seenPaths,
      tense: input.tense,
    });

    discovered.push(...scan.discovered);
    warnings.push(...scan.warnings);
  }

  return {
    discovered: Object.freeze(discovered),
    warnings: Object.freeze(warnings),
  };
}

/** One declared workflows directory's records and warnings, in file order. */
async function scanWorkflowsDirectory(input: {
  pluginName: string;
  workflowsDir: string;
  seenPaths: Set<string>;
  tense: WorkflowOutcomeTense;
}): Promise<{ discovered: DiscoveredWorkflow[]; warnings: string[] }> {
  const { pluginName, workflowsDir, seenPaths, tense } = input;

  const discovered: DiscoveredWorkflow[] = [];
  const warnings: string[] = [];
  const entries = await readDirEntriesTolerant(workflowsDir);

  // Deterministic ordering for stable warning messages and test assertions.
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    const candidate = await isWorkflowScriptFile(workflowsDir, entry);

    if (!candidate.ok) {
      warnings.push(
        readFailureWarning(entry.name, workflowsDir, candidate.reason, tense, "inspect"),
      );
      continue;
    }

    if (!candidate.admit) {
      continue;
    }

    const full = path.join(workflowsDir, entry.name);
    const key = pathDedupKey(full);

    if (seenPaths.has(key)) {
      continue;
    }

    seenPaths.add(key);

    const read = await readScriptSource(full);

    if (!read.ok) {
      warnings.push(readFailureWarning(entry.name, workflowsDir, read.reason, tense, "read"));
      continue;
    }

    const source = read.source;
    const verdict = admitWorkflowScript(pluginName, entry.name, source);
    const warning = verdictWarning(verdict, workflowsDir, tense);

    if (warning !== undefined) {
      warnings.push(warning);
    }

    discovered.push({ verdict, scriptFile: full, source });
  }

  return { discovered, warnings };
}
