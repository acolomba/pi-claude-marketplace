// The strict shape of an Istanbul coverage map this pipeline accepts (D-03,
// D-09): the structure the pinned producer writes and nothing else, checked
// before a map is trusted by any consumer.
//
// Fallow reads a map through a tolerant parser: it clamps a negative
// position, scores a location filled with zeros and estimates a function no
// record matches. A successful Fallow run therefore proves nothing about the
// map. The checks here run instead, on the map in memory and again on the
// JSON read back, and refuse on the first difference from the model below.
//
// Coverage map schema, version 1:
//
//   map                  { [absolutePath]: file }; every key an absolute,
//                        canonical path inside the root, equal to the
//                        record's `path`; no two keys name one file
//   file                 exactly { path, statementMap, fnMap, branchMap,
//                        s, f, b }
//   statementMap[id]     location; `s[id]` its hit
//   fnMap[id]            exactly { name, decl, loc, line }; `f[id]` its hit
//   branchMap[id]        exactly { type, loc, locations, line }; `b[id]` one
//                        hit per location; `type` one of if, cond-expr,
//                        binary-expr, switch, default-arg with the location
//                        count that construct has
//   location             exactly { start, end }, each a position
//   position             keys among { line, column }; a concrete position
//                        is an integer line within the text and an integer
//                        column within the line (`coverage-source-map.mjs`)
//   absent location      both positions without coordinates; admitted only
//                        as the second location of an `if`, the producer's
//                        representation of an implicit else
//   hit                  a finite nonnegative integer
//
// Whether the constructs a map declares are the ones the source declares is
// the correspondence check in `coverage-correspondence.mjs`; this module
// judges shape, counters, positions and paths only.

import path from "node:path";

import { toProjectPath } from "./coverage-capture.manifest.mjs";
import { positionFailures } from "./coverage-source-map.mjs";

export const COVERAGE_SCHEMA_VERSION = 1;

const FILE_FIELDS = {
  path: "string",
  statementMap: "object",
  fnMap: "object",
  branchMap: "object",
  s: "object",
  f: "object",
  b: "object",
};
const FUNCTION_FIELDS = { name: "string", decl: "location", loc: "location", line: "integer" };
const BRANCH_FIELDS = { type: "string", loc: "location", locations: "array", line: "integer" };
const LOCATION_KEYS = ["start", "end"];
const POSITION_KEYS = ["line", "column"];

// How many locations each branch construct of the pinned producer carries.
const BRANCH_ARITY = {
  if: { min: 2, max: 2 },
  "cond-expr": { min: 2, max: 2 },
  "binary-expr": { min: 2, max: Infinity },
  switch: { min: 1, max: Infinity },
  "default-arg": { min: 1, max: 1 },
};

const COUNTERS = [
  ["statementMap", "s"],
  ["fnMap", "f"],
  ["branchMap", "b"],
];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const TYPE_CHECKS = {
  string: (value) => typeof value === "string",
  integer: (value) => Number.isInteger(value),
  array: (value) => Array.isArray(value),
  object: isPlainObject,
};

// The keys `value` lacks from `required` and the keys it has beyond
// `required` plus `optional`.
function keyFailure(part, value, required, optional = []) {
  const present = Object.keys(value);
  const missing = required.filter((key) => !present.includes(key));
  const unknown = present.filter((key) => !required.includes(key) && !optional.includes(key));

  return missing.length === 0 && unknown.length === 0
    ? []
    : [{ kind: "schema-key", part, missing, unknown }];
}

function locationShape(part, location) {
  if (!isPlainObject(location)) {
    return [{ kind: "schema-type", part, expected: "location" }];
  }

  return [
    ...keyFailure(part, location, LOCATION_KEYS),
    ...LOCATION_KEYS.flatMap((end) => {
      const position = location[end];
      return isPlainObject(position)
        ? keyFailure(`${part}.${end}`, position, [], POSITION_KEYS)
        : [{ kind: "schema-type", part: `${part}.${end}`, expected: "position" }];
    }),
  ];
}

// An object with exactly the keys of `fields`, each of the named type; a
// field's part is `fieldPrefix` plus its name.
function recordShape(part, record, fields, fieldPrefix = `${part}.`) {
  if (!isPlainObject(record)) {
    return [{ kind: "schema-type", part, expected: "object" }];
  }

  return [
    ...keyFailure(part, record, Object.keys(fields)),
    ...Object.entries(fields).flatMap(([field, type]) => {
      if (!Object.hasOwn(record, field)) {
        return [];
      }

      if (type === "location") {
        return locationShape(`${fieldPrefix}${field}`, record[field]);
      }

      return TYPE_CHECKS[type](record[field])
        ? []
        : [{ kind: "schema-type", part: `${fieldPrefix}${field}`, expected: type }];
    }),
  ];
}

function branchShape(id, branch) {
  const failures = recordShape(`branchMap[${id}]`, branch, BRANCH_FIELDS);

  if (failures.length > 0) {
    return failures;
  }

  if (!Object.hasOwn(BRANCH_ARITY, branch.type)) {
    return [{ kind: "branch-type", id, type: branch.type }];
  }

  return branch.locations.flatMap((location, index) =>
    locationShape(`branchMap[${id}].locations[${index}]`, location),
  );
}

// Every structural difference from the schema: file keys and types, then
// every record, location and position of the three maps.
function structureFailures(file) {
  const failures = recordShape("file", file, FILE_FIELDS, "");

  if (failures.length > 0) {
    return failures;
  }

  return [
    ...Object.entries(file.statementMap).flatMap(([id, location]) =>
      locationShape(`statementMap[${id}]`, location),
    ),
    ...Object.entries(file.fnMap).flatMap(([id, fn]) =>
      recordShape(`fnMap[${id}]`, fn, FUNCTION_FIELDS),
    ),
    ...Object.entries(file.branchMap).flatMap(([id, branch]) => branchShape(id, branch)),
  ];
}

function isHit(value) {
  return Number.isInteger(value) && value >= 0;
}

function hitFailures(part, value) {
  return isHit(value) ? [] : [{ kind: "hit", part, value }];
}

// The counters of one branch: an array with one hit per location, and as
// many locations as the construct has.
function branchCounterFailures(id, branch, counters) {
  const arity = BRANCH_ARITY[branch.type];
  const locations = branch.locations.length;

  if (!Array.isArray(counters)) {
    return [{ kind: "hit", part: `b[${id}]`, value: counters }];
  }

  if (counters.length !== locations || locations < arity.min || locations > arity.max) {
    return [
      { kind: "branch-cardinality", id, type: branch.type, locations, counters: counters.length },
    ];
  }

  return counters.flatMap((value, index) => hitFailures(`b[${id}][${index}]`, value));
}

// Key sets of each map and its counter equal, every counter a hit, every
// branch with one counter per location.
function counterFailures(file) {
  const failures = [];

  for (const [map, counter] of COUNTERS) {
    const ids = Object.keys(file[map]);
    const counted = Object.keys(file[counter]);
    const missing = ids.filter((id) => !counted.includes(id));
    const extra = counted.filter((id) => !ids.includes(id));

    if (missing.length > 0 || extra.length > 0) {
      failures.push({ kind: "counter-keys", map, counter, missing, extra });
    }
  }

  for (const [id, value] of Object.entries(file.s)) {
    failures.push(...hitFailures(`s[${id}]`, value));
  }

  for (const [id, value] of Object.entries(file.f)) {
    failures.push(...hitFailures(`f[${id}]`, value));
  }

  for (const [id, branch] of Object.entries(file.branchMap)) {
    if (Object.hasOwn(file.b, id)) {
      failures.push(...branchCounterFailures(id, branch, file.b[id]));
    }
  }

  return failures;
}

// A location whose positions carry no coordinates at all; the structure
// check has already limited position keys to line and column.
function isAbsent(location) {
  return LOCATION_KEYS.every((end) =>
    Object.values(location[end]).every((coordinate) => coordinate === undefined),
  );
}

// An absent location is the implicit else and nothing else: the second
// location of an `if`. Anywhere else it is a missing position.
function absentFailures(file) {
  return Object.entries(file.branchMap).flatMap(([id, branch]) =>
    branch.locations.flatMap((location, index) =>
      isAbsent(location) && !(branch.type === "if" && index === 1)
        ? [
            {
              kind: "absent-location",
              part: `branchMap[${id}].locations[${index}]`,
              type: branch.type,
            },
          ]
        : [],
    ),
  );
}

/**
 * Every way the file record `file` differs from the schema above, against
 * the source `text` its positions must lie in: `schema-key` and
 * `schema-type` rows for a structural difference (reported alone, since the
 * other checks assume the structure), then `counter-keys`, `hit`,
 * `branch-cardinality`, `position` and `absent-location` rows. An empty
 * answer means the record has exactly the pinned shape with concrete
 * positions and an absent location only where an `if` has no `else`.
 */
export function fileFailures(file, text) {
  const structure = structureFailures(file);

  if (structure.length > 0) {
    return structure;
  }

  return [...counterFailures(file), ...positionFailures(file, text), ...absentFailures(file)];
}

function isCanonical(key) {
  return path.isAbsolute(key) && path.normalize(key) === key && !key.endsWith(path.sep);
}

// The rows for one map key and the repository path it names; `seen` maps
// each repository path to the first key that named it, so a second key for
// the same file is reported against the first.
function keyVerdict(key, file, root, seen) {
  if (!isPlainObject(file) || typeof file.path !== "string") {
    return { rows: [{ kind: "malformed-file", path: key }] };
  }

  const rows = [];

  if (file.path !== key) {
    rows.push({ kind: "path-mismatch", key, path: file.path });
  }

  if (!isCanonical(key)) {
    rows.push({ kind: "path-not-canonical", path: key });
  }

  if (!path.isAbsolute(key)) {
    return { rows };
  }

  const projectPath = toProjectPath(root, key);

  if (projectPath === undefined) {
    rows.push({ kind: "foreign-path", path: key });
  } else if (seen.has(projectPath)) {
    rows.push({ kind: "duplicate-file", path: projectPath, keys: [seen.get(projectPath), key] });
  } else {
    seen.set(projectPath, key);
  }

  return { rows, projectPath };
}

/**
 * The files of the coverage map `coverage` keyed by repository-relative
 * path under `root`, with the map key each came from, plus every key the
 * map cannot be trusted with: `malformed-map`, `malformed-file`,
 * `path-mismatch` (record `path` differs from its key), `path-not-canonical`
 * (relative, unnormalized or trailing separator), `foreign-path` (outside
 * the root) and `duplicate-file` (two keys naming one file). Only a key with
 * no row is in `files`.
 */
export function mapFiles(coverage, root) {
  const files = new Map();

  if (!isPlainObject(coverage)) {
    return { files, failures: [{ kind: "malformed-map" }] };
  }

  const failures = [];
  const seen = new Map();

  for (const [key, file] of Object.entries(coverage)) {
    const { rows, projectPath } = keyVerdict(key, file, root, seen);
    failures.push(...rows);

    if (rows.length === 0) {
      files.set(projectPath, key);
    }
  }

  return { files, failures };
}
