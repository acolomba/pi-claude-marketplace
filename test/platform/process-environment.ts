/**
 * @fileoverview The one environment allowlist of the node:test tiers. A test
 * that starts a child, or whose code under test starts one from `process.env`,
 * gives that child only the variables the test names. It builds on the cucumber
 * harness's `hostVariables`, so both tiers share one Windows base list and one
 * rule for the case of a name.
 *
 * Every change these functions make to `process.env` goes into one ledger per
 * test case. The ledger keeps the first value it records for each variable,
 * and one `after` hook of the case puts every recorded variable back. So the
 * order of the calls in a case does not change what the case ends with.
 */

import { hostVariables } from "../../features/lib/child-environment.ts";

import type { TestContext } from "node:test";

interface EnvironmentLedger {
  // The value of each variable before the case changed it; undefined when it was not set.
  readonly records: Map<string, string | undefined>;
  // Whether the case recorded the whole environment, so a variable without a
  // record was not set before the case.
  wholeEnvironment: boolean;
}

const ledgers = new WeakMap<TestContext, EnvironmentLedger>();

function restore(ledger: EnvironmentLedger): void {
  if (ledger.wholeEnvironment) {
    // Code under test may add variables during the case.
    for (const name of Object.keys(process.env)) {
      if (!ledger.records.has(name)) {
        Reflect.deleteProperty(process.env, name);
      }
    }
  }

  for (const [name, value] of ledger.records) {
    // An assignment of undefined would store the text "undefined".
    if (value === undefined) {
      Reflect.deleteProperty(process.env, name);
    } else {
      process.env[name] = value;
    }
  }
}

function ledgerFor(t: TestContext): EnvironmentLedger {
  const existing = ledgers.get(t);
  if (existing !== undefined) {
    return existing;
  }

  const ledger: EnvironmentLedger = { records: new Map(), wholeEnvironment: false };
  ledgers.set(t, ledger);
  t.after(() => {
    restore(ledger);
  });
  return ledger;
}

function record(ledger: EnvironmentLedger, name: string): void {
  if (!ledger.records.has(name)) {
    ledger.records.set(name, ledger.wholeEnvironment ? undefined : process.env[name]);
  }
}

/**
 * Records each variable of `names` in the ledger of the case `t`, unless the
 * case recorded it already, so the first record wins. When `t` ends, the
 * ledger puts back each recorded variable, and removes one that was not set.
 */
export function restoreEnvironmentAfter(t: TestContext, names: readonly string[]): void {
  const ledger = ledgerFor(t);
  for (const name of names) {
    record(ledger, name);
  }
}

/**
 * Until the case `t` ends, leaves in `process.env` only the variables that
 * `names` names (with the OS base list of `hostVariables`), and then sets
 * `values`. When `t` ends, `process.env` is again what it was before the first
 * change of the case.
 *
 * Call it before any other change to `process.env` in the case, including
 * `withHermeticEnvironment` and `enterHermeticEnvironment`; their own restore
 * must finish inside the case. `createHermeticEnvironment` shares the ledger,
 * so it may run before or after. Set a variable for the whole case in
 * `values`; a later assignment needs no restore of its own. Where the case
 * registers an `after` hook that stops its children, call this after that
 * registration, so the environment comes back only once the children stop.
 */
export function useAllowlistedProcessEnvironment(
  t: TestContext,
  names: readonly string[],
  values: Readonly<Record<string, string>> = {},
): void {
  const ledger = ledgerFor(t);
  for (const name of [...Object.keys(process.env), ...Object.keys(values)]) {
    record(ledger, name);
  }

  ledger.wholeEnvironment = true;
  const kept = hostVariables(names);
  for (const name of Object.keys(process.env)) {
    if (!Object.hasOwn(kept, name)) {
      Reflect.deleteProperty(process.env, name);
    }
  }

  Object.assign(process.env, values);
}

/**
 * Returns a new environment for a child: the variables of this process that
 * `names` names (with the OS base list of `hostVariables`), and then `values`.
 * On Windows, a host variable that `values` also sets, in any case, is left
 * out, so the child gets one spelling of it.
 */
export function allowlistedEnvironment(
  names: readonly string[],
  values: Readonly<Record<string, string>> = {},
): NodeJS.ProcessEnv {
  const host = hostVariables(names);
  if (process.platform === "win32") {
    const valueNames = new Set(Object.keys(values).map((name) => name.toUpperCase()));
    for (const name of Object.keys(host)) {
      if (valueNames.has(name.toUpperCase())) {
        Reflect.deleteProperty(host, name);
      }
    }
  }

  return { ...host, ...values };
}
