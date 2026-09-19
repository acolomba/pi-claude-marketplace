// Builds and verifies the maintained producer delivery (D-05): the exact
// upstream ast-v8-to-istanbul 1.0.6 distribution plus one reviewed patch,
// packaged as the npm tarball under vendor/coverage/ that package.json
// installs. Nothing here runs during ordinary tests or gates; installed
// dependencies are never edited.
//
// `--build` fetches the upstream tarball (or reads `--upstream <tgz>`),
// refuses it unless its sha512 is the pinned registry integrity, applies the
// patch in two separately created temporary copies, packs both with
// `npm pack`, refuses the build unless the two archives are byte-identical,
// and only then writes the archive and the original LICENSE next to the
// patch. It ends by running the same verification a reader runs.
//
// `--verify` works offline from the vendored files alone: the archive's
// integrity and every entry digest, the license bytes, the patch digest and
// its exact context (reverse-applied, the patched entries must hash back to
// the pinned upstream bytes), and the provenance record naming every digest.
// Any difference is a refusal, never a repair.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

/**
 * The complete identity of the delivery. Every digest is SHA-256 hex unless
 * it starts with `sha512-`, which is the registry integrity form. The
 * producer adapter compares the installed package against it.
 */
export const DELIVERY = {
  name: "ast-v8-to-istanbul",
  upstream: {
    version: "1.0.6",
    tarball: "https://registry.npmjs.org/ast-v8-to-istanbul/-/ast-v8-to-istanbul-1.0.6.tgz",
    integrity:
      "sha512-fvpl29helSO2w/z7utIbrkNXILdrLwDwAMH2I/zPKlGf5244+gf+B4cyS1sANcrPY2h+hWCGSgC8N61s/+AF9A==",
    files: {
      "package/LICENSE": "7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a",
      "package/README.md": "9e51b017ef327dd6d004c2f0d7b031572a2f954562c37e3e4d6945b83360ddae",
      "package/dist/index.d.mts":
        "7e4de81c67aaa01f9202bb56242f85355e6a78bd327260294e8e26ada36f4b02",
      "package/dist/index.mjs": "0ce3ec436049c66fff8757450230369156ee2126f52d06b41f99780e497d0a79",
      "package/package.json": "a9a1858c8b20842c0019b83fef8460cffb24e4b1264427362abc38ee4cb28eb9",
    },
  },
  version: "1.0.6-project.1",
  patch: {
    file: "ast-v8-to-istanbul-1.0.6.patch",
    digest: "a2884779313619c7422227896e6f9541aec8de8e525b92c679eea5acf774a068",
  },
  license: {
    file: "LICENSE",
    digest: "7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a",
  },
  archive: {
    file: "ast-v8-to-istanbul-1.0.6-project.1.tgz",
    integrity:
      "sha512-6KzTeECN1o+Xo9KtrN78sK5gWF37nL1vZYxrVTj/iBCE2qPGC/si5KnuDfDYV6KihNMwlMdjWciZMnsrI93fEg==",
    digest: "ef911b69325c681e15dfc141a5872a356c2333fb8153953fbfe8519265da2e49",
    files: {
      "package/LICENSE": "7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a",
      "package/README.md": "9e51b017ef327dd6d004c2f0d7b031572a2f954562c37e3e4d6945b83360ddae",
      "package/dist/index.d.mts":
        "7e4de81c67aaa01f9202bb56242f85355e6a78bd327260294e8e26ada36f4b02",
      "package/dist/index.mjs": "29377dc2bb113e40525edb050434420b0d071122c9aa382174a8d622a35c8874",
      "package/package.json": "e188df9ab9e07a4cc4e6012930ae719cf4bb4344d2e8bbbcb0b6539947022685",
    },
  },
  provenance: "PROVENANCE.md",
};

/** The repository-relative directory that holds the delivery. */
export const VENDOR_DIRECTORY = "vendor/coverage";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

class UsageError extends Error {}

// A build or verification refusal; `failures` lists every `{ kind, ... }` row.
class DeliveryError extends Error {
  constructor(failures) {
    super(failures.map((failure) => JSON.stringify(failure)).join("\n"));
    this.name = "DeliveryError";
    this.failures = failures;
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function integrityOf(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

// A ustar reader for npm tarballs: gzip, then 512-byte headers with the
// entry name, octal size and type. Only regular files are accepted; any
// other entry is refused rather than skipped.
function readTarball(bytes) {
  let tar;

  try {
    tar = gunzipSync(bytes);
  } catch (error) {
    throw new DeliveryError([{ kind: "archive-unreadable", error: String(error) }]);
  }

  const entries = new Map();
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);

    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = header.toString("utf8", 0, 100).replace(/\0.*$/su, "");
    const size = Number.parseInt(header.toString("utf8", 124, 136).replace(/\0.*$/su, ""), 8);
    const type = String.fromCharCode(header[156]);

    if (type !== "0" && type !== "\0") {
      throw new DeliveryError([{ kind: "unsupported-entry", name, type }]);
    }

    entries.set(name, Buffer.from(tar.subarray(offset + 512, offset + 512 + size)));
    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function parseHunkHeader(line) {
  const match = /^@@ -(?<oldStart>\d+)(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@/u.exec(line);

  if (match === null) {
    throw new DeliveryError([{ kind: "patch-format", line }]);
  }

  return { oldStart: Number(match.groups.oldStart), newStart: Number(match.groups.newStart) };
}

// Parses a unified diff into `[{ file, hunks: [{ oldStart, newStart, lines }] }]`
// where each hunk line keeps its leading ` `, `-` or `+`. Text before the
// first `--- a/` header is commentary.
function parsePatch(text) {
  const files = [];
  let current = null;
  let hunk = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("--- a/")) {
      current = { file: line.slice("--- a/".length), hunks: [] };
      files.push(current);
      hunk = null;
    } else if (line.startsWith("+++ b/")) {
      if (current === null || line.slice("+++ b/".length) !== current.file) {
        throw new DeliveryError([{ kind: "patch-format", line }]);
      }
    } else if (line.startsWith("@@")) {
      hunk = { ...parseHunkHeader(line), lines: [] };
      current.hunks.push(hunk);
    } else if (hunk !== null && /^[ +-]/u.test(line)) {
      hunk.lines.push(line);
    } else if (hunk !== null && line !== "") {
      throw new DeliveryError([{ kind: "patch-format", line }]);
    }
  }

  return files;
}

// Strict application: every hunk's old lines must sit exactly at the stated
// line number, with no offset and no fuzz. `reverse` swaps the roles of the
// `-` and `+` lines so the same patch turns the delivery back into upstream.
function applyHunks(text, hunks, reverse) {
  const removed = reverse ? "+" : "-";
  const added = reverse ? "-" : "+";
  const lines = text.split("\n");
  let shift = 0;

  for (const hunk of hunks) {
    const start = (reverse ? hunk.newStart : hunk.oldStart) - 1 + shift;
    const oldLines = hunk.lines
      .filter((line) => !line.startsWith(added))
      .map((line) => line.slice(1));
    const newLines = hunk.lines
      .filter((line) => !line.startsWith(removed))
      .map((line) => line.slice(1));
    const actual = lines.slice(start, start + oldLines.length);

    if (actual.join("\n") !== oldLines.join("\n")) {
      throw new DeliveryError([
        { kind: "patch-context", line: start + 1, expected: oldLines, actual },
      ]);
    }

    lines.splice(start, oldLines.length, ...newLines);
    shift += newLines.length - oldLines.length;
  }

  return lines.join("\n");
}

function applyPatch(entries, patch, reverse) {
  const patched = new Map(entries);

  for (const { file, hunks } of patch) {
    const name = `package/${file}`;
    const original = patched.get(name);

    if (original === undefined) {
      throw new DeliveryError([{ kind: "patch-target-missing", file }]);
    }

    patched.set(name, Buffer.from(applyHunks(original.toString("utf8"), hunks, reverse), "utf8"));
  }

  return patched;
}

function entryDigestFailures(entries, expected, kind) {
  const failures = [];
  const names = [...entries.keys()].sort();

  if (names.join("\n") !== Object.keys(expected).sort().join("\n")) {
    failures.push({
      kind: "archive-entries",
      expected: Object.keys(expected).sort(),
      actual: names,
    });
    return failures;
  }

  for (const [name, digest] of Object.entries(expected)) {
    const actual = sha256(entries.get(name));

    if (actual !== digest) {
      failures.push({ kind, name, expected: digest, actual });
    }
  }

  return failures;
}

function vendorFile(vendorDirectory, fileName) {
  const filePath = path.join(vendorDirectory, fileName);
  return existsSync(filePath) ? readFileSync(filePath) : undefined;
}

function archiveFailures(archive) {
  const failures = [];

  if (integrityOf(archive) !== DELIVERY.archive.integrity) {
    failures.push({ kind: "archive-integrity", actual: integrityOf(archive) });
  }

  if (sha256(archive) !== DELIVERY.archive.digest) {
    failures.push({ kind: "archive-digest", actual: sha256(archive) });
  }

  return failures;
}

function licenseFailures(vendorDirectory, entries) {
  const license = vendorFile(vendorDirectory, DELIVERY.license.file);

  if (license === undefined) {
    return [{ kind: "missing-license", file: DELIVERY.license.file }];
  }

  const failures = [];

  if (sha256(license) !== DELIVERY.license.digest) {
    failures.push({ kind: "license-digest", actual: sha256(license) });
  }

  if (!license.equals(entries.get("package/LICENSE") ?? Buffer.alloc(0))) {
    failures.push({ kind: "license-mismatch" });
  }

  return failures;
}

// The patch must hash to its pinned digest and, reverse-applied to the
// delivered entries with exact context, must give back the pinned upstream
// bytes for every entry.
function patchFailures(vendorDirectory, entries) {
  const patchBytes = vendorFile(vendorDirectory, DELIVERY.patch.file);

  if (patchBytes === undefined) {
    return [{ kind: "missing-patch", file: DELIVERY.patch.file }];
  }

  const failures = [];

  if (sha256(patchBytes) !== DELIVERY.patch.digest) {
    failures.push({ kind: "patch-digest", actual: sha256(patchBytes) });
  }

  try {
    const upstream = applyPatch(entries, parsePatch(patchBytes.toString("utf8")), true);
    failures.push(...entryDigestFailures(upstream, DELIVERY.upstream.files, "upstream-digest"));
  } catch (error) {
    if (!(error instanceof DeliveryError)) {
      throw error;
    }

    failures.push(...error.failures);
  }

  return failures;
}

function provenanceFailures(vendorDirectory) {
  const provenance = vendorFile(vendorDirectory, DELIVERY.provenance);

  if (provenance === undefined) {
    return [{ kind: "missing-provenance", file: DELIVERY.provenance }];
  }

  const text = provenance.toString("utf8");
  const required = [
    DELIVERY.upstream.version,
    DELIVERY.upstream.tarball,
    DELIVERY.upstream.integrity,
    ...Object.values(DELIVERY.upstream.files),
    DELIVERY.version,
    DELIVERY.patch.digest,
    DELIVERY.license.digest,
    DELIVERY.archive.integrity,
    DELIVERY.archive.digest,
    ...Object.values(DELIVERY.archive.files),
  ];

  return required
    .filter((value) => !text.includes(value))
    .map((value) => ({ kind: "provenance-missing-value", value }));
}

// Verifies the vendored delivery offline. Returns `{ ok: true }` or
// `{ ok: false, failures }` with every refusal found.
function verifyDelivery(vendorDirectory) {
  const archive = vendorFile(vendorDirectory, DELIVERY.archive.file);

  if (archive === undefined) {
    return { ok: false, failures: [{ kind: "missing-archive", file: DELIVERY.archive.file }] };
  }

  const failures = archiveFailures(archive);
  let entries;

  try {
    entries = readTarball(archive);
  } catch (error) {
    if (error instanceof DeliveryError) {
      return { ok: false, failures: [...failures, ...error.failures] };
    }

    throw error;
  }

  failures.push(
    ...entryDigestFailures(entries, DELIVERY.archive.files, "payload-digest"),
    ...licenseFailures(vendorDirectory, entries),
    ...patchFailures(vendorDirectory, entries),
    ...provenanceFailures(vendorDirectory),
  );

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

async function fetchUpstream() {
  const response = await fetch(DELIVERY.upstream.tarball);

  if (!response.ok) {
    throw new DeliveryError([{ kind: "upstream-fetch", status: response.status }]);
  }

  return Buffer.from(await response.arrayBuffer());
}

// Writes the patched entries into a fresh temporary package directory and
// packs it with npm, scripts disabled, returning the archive bytes.
function packOnce(entries) {
  const workspace = mkdtempSync(path.join(tmpdir(), "coverage-producer-build-"));

  try {
    for (const [name, bytes] of entries) {
      const target = path.join(workspace, name);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }

    const packed = spawnSync(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", workspace],
      { cwd: path.join(workspace, "package"), encoding: "utf8" },
    );

    if (packed.status !== 0) {
      throw new DeliveryError([{ kind: "pack-failed", stderr: packed.stderr }]);
    }

    const [{ filename }] = JSON.parse(packed.stdout);
    return readFileSync(path.join(workspace, filename));
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
}

function writeAtomically(filePath, bytes) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, bytes);
  renameSync(temporaryPath, filePath);
}

// Builds the delivery from verified upstream bytes and the vendored patch,
// writes the archive and license into `vendorDirectory`, and returns the
// identity of what was written. Refuses an upstream tarball whose integrity
// or entry digests differ from the pins and a non-reproducible pack.
async function buildDelivery(vendorDirectory, upstreamPath) {
  const upstream = upstreamPath === undefined ? await fetchUpstream() : readFileSync(upstreamPath);

  if (integrityOf(upstream) !== DELIVERY.upstream.integrity) {
    throw new DeliveryError([{ kind: "upstream-integrity", actual: integrityOf(upstream) }]);
  }

  const entries = readTarball(upstream);
  const upstreamFailures = entryDigestFailures(entries, DELIVERY.upstream.files, "upstream-digest");

  if (upstreamFailures.length > 0) {
    throw new DeliveryError(upstreamFailures);
  }

  const patchBytes = vendorFile(vendorDirectory, DELIVERY.patch.file);

  if (patchBytes === undefined) {
    throw new DeliveryError([{ kind: "missing-patch", file: DELIVERY.patch.file }]);
  }

  const patched = applyPatch(entries, parsePatch(patchBytes.toString("utf8")), false);
  const first = packOnce(patched);
  const second = packOnce(patched);

  if (!first.equals(second)) {
    throw new DeliveryError([{ kind: "nondeterministic-archive" }]);
  }

  writeAtomically(path.join(vendorDirectory, DELIVERY.archive.file), first);
  writeAtomically(
    path.join(vendorDirectory, DELIVERY.license.file),
    entries.get("package/LICENSE"),
  );
  const files = {};

  for (const [name, bytes] of [...readTarball(first)].sort(([a], [b]) => a.localeCompare(b))) {
    files[name] = sha256(bytes);
  }

  return {
    upstream: { integrity: integrityOf(upstream), digest: sha256(upstream) },
    patch: { digest: sha256(patchBytes) },
    archive: { integrity: integrityOf(first), digest: sha256(first), files },
  };
}

function parseArguments(args) {
  const options = {
    mode: undefined,
    vendor: path.join(projectRoot, VENDOR_DIRECTORY),
    upstream: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];

    if (argument === "--build" || argument === "--verify") {
      options.mode = argument.slice(2);
    } else if ((argument === "--vendor" || argument === "--upstream") && value !== undefined) {
      options[argument.slice(2)] = path.resolve(value);
      index += 1;
    } else {
      throw new UsageError(
        `Unknown option: ${argument}. Pass --build [--upstream <tgz>] or --verify, with an optional --vendor <dir>.`,
      );
    }
  }

  if (options.mode === undefined) {
    throw new UsageError("Pass --build or --verify.");
  }

  return options;
}

function reportVerdict(verdict, vendor) {
  if (verdict.ok) {
    process.stdout.write(
      `Producer delivery verified: ${DELIVERY.name}@${DELIVERY.version} in ${vendor}\n`,
    );
    return 0;
  }

  const reasons = verdict.failures.map((failure) => `  ${JSON.stringify(failure)}`).join("\n");
  process.stderr.write(`Producer delivery refused:\n${reasons}\n`);
  return 1;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.mode === "build") {
    const built = await buildDelivery(options.vendor, options.upstream);
    process.stdout.write(`${JSON.stringify(built, undefined, 2)}\n`);
  }

  return reportVerdict(verifyDelivery(options.vendor), options.vendor);
}

const invokedPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);

if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  }
}
