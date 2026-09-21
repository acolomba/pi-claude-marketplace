// bridges/workflows/discover.ts
//
// Bridge primitive: enumerate flat script files under each declared
// `componentPaths.workflows` entry (WBRG-02 -- non-recursive, ignore
// non-scripts), or the one script a declared entry names directly, read each
// one, and hand it to `domain/workflow-script.ts` for a verdict. Returns a
// deterministic `DiscoveredWorkflow[]` -- every verdict arm, not just the
// admitted ones -- plus a `warnings[]` channel for WBRG-03 soft-fails.
//
// A declared entry may name a directory or a single `.js` file, which is the
// shape Claude Code's plugin loader accepts: it `stat`s each manifest path and
// scans a directory or loads a file. Both arms run one candidate through the
// same per-entry pipeline, so a script declared by path is judged exactly as
// one found in a directory.
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

import fs from "node:fs/promises";
import path from "node:path";

import {
  admitWorkflowScript,
  forMessage,
  WORKFLOW_SCRIPT_MAX_BYTES,
  WORKFLOW_SCRIPT_SUFFIX,
} from "../../domain/workflow-script.ts";
import { errorMessage, isErrnoException } from "../../shared/errors.ts";
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
 * The entry shape both discovery arms feed the per-candidate pipeline: a
 * `readdir` dirent for the directory arm, and a synthesized one for a declared
 * file. Only the two members the filter reads are required.
 */
type CandidateEntry = Pick<Dirent, "name" | "isFile">;

/**
 * Whether a candidate is a workflow script this bridge will read, decided in the
 * order the filter can answer cheapest.
 *
 * The suffix test is EXACT -- `.js`, in that case -- because that is the test
 * Claude Code's loader applies (`name.endsWith(".js")`), and admitting a wider
 * set would install commands the plugin does not have upstream.
 *
 * Dotfiles, directories, symlinks and non-script suffixes are all excluded by
 * the dirent filter, before the `lstat`, so the scan stays flat and reads
 * nothing it will not decide. The `lstat` re-asks the symlink question against
 * the live filesystem rather than the `readdir` snapshot -- see the module
 * header for why both layers are here -- and answers the size question from the
 * same call: an entry above `WORKFLOW_SCRIPT_MAX_BYTES` is a per-file skip
 * carrying its size, never read.
 *
 * WBRG-03: the `lstat` rides the same per-file soft-fail channel as the
 * `readFile` below it. Both IO calls land on the same file one step apart, so
 * opposite failure policies would mean an EACCES decided the whole plugin's
 * fate or one file's, depending only on which call reached the file first.
 */
async function isWorkflowScriptFile(
  dir: string,
  entry: CandidateEntry,
): Promise<
  | { ok: true; admit: true }
  | { ok: true; admit: false; oversize?: number }
  | { ok: false; reason: string }
> {
  if (
    entry.name.startsWith(".") ||
    !entry.isFile() ||
    !entry.name.endsWith(WORKFLOW_SCRIPT_SUFFIX)
  ) {
    return { ok: true, admit: false };
  }

  try {
    const stats = await fs.lstat(path.join(dir, entry.name));
    // A symlink is refused silently, as the dirent filter above already did for
    // the entry `readdir` reported; only a plain file can be oversize.
    const plain = !stats.isSymbolicLink();
    const oversize = plain && stats.size > WORKFLOW_SCRIPT_MAX_BYTES;

    return oversize ? { ok: true, admit: false, oversize: stats.size } : { ok: true, admit: plain };
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }
}

/**
 * WBRG-03: the one message shape every per-file soft-fail wears. Each warning
 * names the FILE and the containing DIRECTORY, so a user reading it can find
 * the script without cross-referencing anything, and then renders the reason
 * it was handed rather than composing a new one.
 *
 * Every untrusted span goes through `forMessage`, at the point it enters the
 * string, which is the rule the decision layer states. Three of the four
 * arguments carry plugin-controlled text: the file name, which a POSIX
 * filesystem lets carry a newline or a bidi override; the directory, whose
 * every segment below the plugin root is named by the plugin; and the reason,
 * which is an escaped decision-layer sentence on some paths but a raw
 * `errorMessage(err)` on the two IO paths, and an errno message quotes the
 * offending path back verbatim. `notifyDiagnostic` joins these lines on "\n"
 * and renders them uninspected, so an unescaped newline anywhere in here is a
 * forged line the reader cannot tell from a real one.
 *
 * `forMessage` is idempotent -- its output holds no `\p{Cc}` or `\p{Cf}` -- so
 * an already-escaped reason passes through unchanged rather than double-
 * escaped. `outcome` is the only argument left raw: it is never anything but
 * a literal out of one of the two tense tables above.
 */
function softFailWarning(
  fileName: string,
  workflowsDir: string,
  outcome: string,
  reason: string,
): string {
  return `workflow script "${forMessage(fileName)}" in "${forMessage(workflowsDir)}" ${outcome}: ${forMessage(reason)}`;
}

/**
 * WR-09: what the `install` surface says happened, one phrase per site.
 *
 * Total over the site union, which is the forcing construct: a further site
 * cannot be composed without an entry here AND in the preview table below, so
 * the two tenses cannot drift apart by omission.
 *
 * WGATE-01: the `gate` phrase states the admitted fact BEFORE its caveat,
 * because the envelope is written and the command is registered. A phrase
 * shaped like the soft-fails would report a disposal that did not happen.
 */
const INSTALL_OUTCOMES: Record<WorkflowOutcomeSite, string> = {
  skipped: "was not installed",
  refused: "was refused",
  read: "could not be read and was skipped",
  inspect: "could not be inspected and was skipped",
  oversize: "was not installed",
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
  read: "could not be read",
  inspect: "could not be inspected",
  oversize: "will not be installed",
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
  // The list names every form the check-8 predicates refuse -- read off
  // `isLiteralProperty`, `isLiteralValue` and `isLiteralArray` in
  // `domain/workflow-script.ts`, which between them refuse nine. Nothing gates
  // the correspondence, so an arm added to any of the three has to be added
  // here by hand, and an author tripping an unnamed one is handed a sentence
  // listing eight other things and not theirs.
  "meta-not-pure-literal":
    "the engine refuses at its check 8 -- every value inside `meta` must be a plain literal, so no spread, computed key, key written as anything but an identifier, string or number, method, accessor, reserved key name (`__proto__`, `constructor`, `prototype`), array hole, substituted template or computed expression",
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
 * A candidate above `WORKFLOW_SCRIPT_MAX_BYTES`. The reason names both numbers
 * so the author can see how far over the file is, and attributes the bound to
 * Claude Code, whose loader is the one that imposes it.
 */
function oversizeWarning(
  fileName: string,
  workflowsDir: string,
  size: number,
  tense: WorkflowOutcomeTense,
): string {
  return softFailWarning(
    fileName,
    workflowsDir,
    outcomePhrase(tense, "oversize"),
    `the file is ${size.toString()} bytes and Claude Code loads a plugin workflow script only up to ${WORKFLOW_SCRIPT_MAX_BYTES.toString()} bytes`,
  );
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
    raw = await fs.readFile(full);
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
 * The `named` arm earns a row only when the script carries a gate: the envelope
 * is still written and the record still returned, so that row is a caveat
 * rather than a refusal. ONE LINE PER FILE.
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

  if (verdict.gate === undefined) {
    return undefined;
  }

  return gateWarning(verdict.fileName, workflowsDir, tense, verdict.gate);
}

/**
 * WBRG-02 / WBRG-03: walk every declared workflows entry -- a directory, or
 * one script named directly -- decide each script, and return the FULL verdict
 * array.
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
 * `pathDedupKey` for why the comparison is case-folded on some platforms. The
 * same set covers a script declared by path AND found under a declared
 * directory, which Claude Code's loader also collapses to one.
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
    const declared = path.resolve(input.resolved.pluginRoot, workflowsRel);
    // NFR-10: `path.resolve` honors an absolute declared path outright, so the
    // containment check is what makes a declared `/etc` a refusal rather than
    // a walk. Loud by design (PathContainmentError) -- a declared path that
    // escapes the plugin root is a defect of the manifest, not of one file.
    await assertPathInside(
      input.resolved.pluginRoot,
      declared,
      `workflows component path "${workflowsRel}"`,
    );

    const scan = await scanDeclaredPath({
      pluginName: input.pluginName,
      declared,
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

/** What one declared entry's records and warnings are collected into. */
interface ScanAccumulator {
  readonly discovered: DiscoveredWorkflow[];
  readonly warnings: string[];
}

/**
 * One declared entry: a directory is scanned flat, a regular file is run
 * through the per-candidate pipeline as the single entry of its parent
 * directory, and anything else yields nothing.
 *
 * No symlink question is asked here: `assertPathInside` has already refused a
 * declared path with a symlink segment, so what `stat` classifies is a real
 * directory or a real file.
 *
 * ENOENT is the one answer that describes the declared path rather than the
 * machine -- absent, so the plugin declares no scripts there -- and it is the
 * only failure the containment check above lets through: that check `lstat`s
 * every segment down to the declared path itself, tolerates ENOENT on the
 * leaf, and rethrows everything else, ENOTDIR included. Every other errno
 * propagates here too: a read that may be unreliable must not quietly install
 * a subset of the plugin.
 */
async function scanDeclaredPath(input: {
  pluginName: string;
  declared: string;
  seenPaths: Set<string>;
  tense: WorkflowOutcomeTense;
}): Promise<ScanAccumulator> {
  const acc: ScanAccumulator = { discovered: [], warnings: [] };

  let stats;
  try {
    stats = await fs.stat(input.declared);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") {
      return acc;
    }

    throw err;
  }

  if (stats.isDirectory()) {
    await scanWorkflowsDirectory({ ...input, workflowsDir: input.declared, acc });
  } else if (stats.isFile()) {
    await scanCandidate({
      ...input,
      workflowsDir: path.dirname(input.declared),
      entry: { name: path.basename(input.declared), isFile: () => true },
      acc,
    });
  }

  return acc;
}

/** One declared workflows directory's records and warnings, in file order. */
async function scanWorkflowsDirectory(input: {
  pluginName: string;
  workflowsDir: string;
  seenPaths: Set<string>;
  tense: WorkflowOutcomeTense;
  acc: ScanAccumulator;
}): Promise<void> {
  const entries = await readDirEntriesTolerant(input.workflowsDir);

  // Deterministic ordering for stable warning messages and test assertions.
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sorted) {
    await scanCandidate({ ...input, entry });
  }
}

/**
 * The per-candidate pipeline both arms share: filter, dedup by source path,
 * read, decide, and append the record and its warning (if any) to `acc`.
 */
async function scanCandidate(input: {
  pluginName: string;
  workflowsDir: string;
  entry: CandidateEntry;
  seenPaths: Set<string>;
  tense: WorkflowOutcomeTense;
  acc: ScanAccumulator;
}): Promise<void> {
  const { pluginName, workflowsDir, entry, seenPaths, tense, acc } = input;
  const candidate = await isWorkflowScriptFile(workflowsDir, entry);

  if (!candidate.ok) {
    acc.warnings.push(
      readFailureWarning(entry.name, workflowsDir, candidate.reason, tense, "inspect"),
    );
    return;
  }

  if (!candidate.admit) {
    if (candidate.oversize !== undefined) {
      acc.warnings.push(oversizeWarning(entry.name, workflowsDir, candidate.oversize, tense));
    }

    return;
  }

  const full = path.join(workflowsDir, entry.name);
  const key = pathDedupKey(full);

  if (seenPaths.has(key)) {
    return;
  }

  seenPaths.add(key);

  const read = await readScriptSource(full);

  if (!read.ok) {
    acc.warnings.push(readFailureWarning(entry.name, workflowsDir, read.reason, tense, "read"));
    return;
  }

  const source = read.source;
  const verdict = admitWorkflowScript(pluginName, entry.name, source);
  const warning = verdictWarning(verdict, workflowsDir, tense);

  if (warning !== undefined) {
    acc.warnings.push(warning);
  }

  acc.discovered.push({ verdict, scriptFile: full, source });
}
