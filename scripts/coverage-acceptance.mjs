// The acceptance summary of a verified unit run: the production population
// and the native and syntax denominators an accepted manifest records
// (D-02, D-04, D-07).
//
// `coverage-unit.mjs` computes the summary from the run it publishes, and
// `coverage-validate.mjs` recomputes it from the bundle it reads back and
// requires the two to agree, so an accepted manifest whose counts describe
// another run is refused. The two denominators are two measurements of the
// same run and are never equated: native totals are Node's own LCOV over
// the loaded files, syntax totals are the model over every production file.

import { readFileSync } from "node:fs";
import path from "node:path";

import { classifySyntax } from "./coverage-correspondence.mjs";
import { recordedModule } from "./coverage-source-map.mjs";

/** The production sources the run inventoried, in inventory order. */
export function productionPaths(run) {
  return JSON.parse(readFileSync(path.join(run.directory, "inventory.json"), "utf8"))
    .filter((entry) => entry.group === "production")
    .map((entry) => entry.path);
}

// The production population: every source the run inventoried is either
// loaded or unloaded, and each unloaded one is classified from its recorded
// executed text.
function populationOf(run, manifest) {
  const production = new Set(productionPaths(run));
  const loaded = manifest.modules.filter((record) => production.has(record.path));
  const unloaded = manifest.unloaded.map((record) => ({
    ...record,
    ...classifySyntax(recordedModule(run, record.path).executed),
  }));

  return {
    production: production.size,
    loaded: loaded.length,
    unloaded,
    typeOnly: unloaded.filter((record) => record.syntax === "type-only").length,
    executable: unloaded.filter((record) => record.syntax === "executable").length,
  };
}

// The runner's own totals from the native LCOV: records, lines, functions and
// branches as Node counts them.
function nativeTotals(lcovText) {
  const totals = {
    records: 0,
    lines: { found: 0, hit: 0 },
    functions: { found: 0, hit: 0 },
    branches: { found: 0, hit: 0 },
  };
  const fields = {
    LF: ["lines", "found"],
    LH: ["lines", "hit"],
    FNF: ["functions", "found"],
    FNH: ["functions", "hit"],
    BRF: ["branches", "found"],
    BRH: ["branches", "hit"],
  };

  for (const line of lcovText.split("\n")) {
    const [key, value] = line.split(":");
    const target = fields[key];

    if (line === "end_of_record") {
      totals.records += 1;
    } else if (target !== undefined) {
      totals[target[0]][target[1]] += Number(value);
    }
  }

  return totals;
}

// The map's own totals over the syntax model: constructs and how many of
// them executed.
function syntaxTotals(map) {
  const totals = {
    files: 0,
    functions: { total: 0, covered: 0 },
    statements: { total: 0, covered: 0 },
    branchArms: { total: 0, covered: 0 },
  };
  const count = (counter, hits) => {
    for (const value of hits) {
      counter.total += 1;
      counter.covered += value > 0 ? 1 : 0;
    }
  };

  for (const file of Object.values(map)) {
    totals.files += 1;
    count(totals.functions, Object.values(file.f));
    count(totals.statements, Object.values(file.s));
    count(totals.branchArms, Object.values(file.b).flat());
  }

  return totals;
}

/**
 * The population and the two denominators of `run`, from the run's own
 * records, the LCOV the manifest names and the map the run converted to.
 */
export function acceptanceSummary(root, run, manifest, map) {
  return {
    population: populationOf(run, manifest),
    denominators: {
      native: nativeTotals(readFileSync(path.join(root, manifest.artifacts.lcov.path), "utf8")),
      syntax: syntaxTotals(map),
    },
  };
}
