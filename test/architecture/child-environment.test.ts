/**
 * @fileoverview Checks the environment allowlists of both test tiers: the
 * cucumber harness's `hostVariables` and the node:test helpers built on it.
 * A child gets only the variables its test names, plus the OS base list on
 * Windows, and every case that changes `process.env` through the helpers ends
 * with the environment it started with.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hostVariables } from "../../features/lib/child-environment.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import {
  allowlistedEnvironment,
  restoreEnvironmentAfter,
  useAllowlistedProcessEnvironment,
} from "../platform/process-environment.ts";

function windowsBase(): Record<string, string> {
  return {
    SystemRoot: "C:\\Windows",
    ComSpec: "C:\\Windows\\system32\\cmd.exe",
    PATHEXT: ".COM;.EXE;.BAT",
    TEMP: "C:\\Users\\case\\Temp",
    TMP: "C:\\Users\\case\\Temp",
    USERPROFILE: "C:\\Users\\case",
  };
}

function windowsHost(): Record<string, string> {
  return {
    ...windowsBase(),
    Path: "C:\\Windows\\system32",
    GIT_DIR: "C:\\shell\\repo\\.git",
  };
}

describe("hostVariables", () => {
  test("copies only the named variables that are set", (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], {
      PI_CM_CHILD_KEPT: "host-kept",
      GIT_DIR: "/shell/repo/.git",
    });
    t.mock.property(process, "platform", "linux");

    // act
    const variables = hostVariables(["PI_CM_CHILD_KEPT", "PI_CM_CHILD_UNSET"]);

    // assert
    assert.deepStrictEqual(variables, { PI_CM_CHILD_KEPT: "host-kept" });
  });

  test("on Windows, adds the six base variables and matches a name in any case", (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], windowsHost());
    t.mock.property(process, "platform", "win32");

    // act
    const variables = hostVariables(["path"]);

    // assert
    assert.deepStrictEqual(variables, { ...windowsBase(), Path: "C:\\Windows\\system32" });
  });
});

describe("allowlistedEnvironment", () => {
  test("adds the values over the named host variables", (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], {
      PI_CM_CHILD_KEPT: "host-kept",
      PI_CM_CHILD_REPLACED: "host-replaced",
    });
    t.mock.property(process, "platform", "linux");

    // act
    const environment = allowlistedEnvironment(["PI_CM_CHILD_KEPT", "PI_CM_CHILD_REPLACED"], {
      PI_CM_CHILD_REPLACED: "case-replaced",
      PI_CM_CHILD_ADDED: "case-added",
    });

    // assert
    assert.deepStrictEqual(environment, {
      PI_CM_CHILD_KEPT: "host-kept",
      PI_CM_CHILD_REPLACED: "case-replaced",
      PI_CM_CHILD_ADDED: "case-added",
    });
  });

  test("on Windows, keeps one spelling of a variable that the values also set", (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], windowsHost());
    t.mock.property(process, "platform", "win32");

    // act
    const environment = allowlistedEnvironment(["PATH"], { PATH: "C:\\case\\bin" });

    // assert
    assert.deepStrictEqual(environment, { ...windowsBase(), PATH: "C:\\case\\bin" });
  });
});

describe("useAllowlistedProcessEnvironment", () => {
  test("leaves only the named variables and the values while the case runs", async (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], {
      PI_CM_CHILD_KEPT: "host-kept",
      PI_CM_CHILD_DROPPED: "host-dropped",
    });
    t.mock.property(process, "platform", "linux");
    let environmentInCase: NodeJS.ProcessEnv = {};

    // act
    await t.test("case", (caseContext) => {
      useAllowlistedProcessEnvironment(caseContext, ["PI_CM_CHILD_KEPT"], {
        PI_CM_CHILD_VALUE: "case-value",
      });
      environmentInCase = { ...process.env };
    });

    // assert
    assert.deepStrictEqual(environmentInCase, {
      PI_CM_CHILD_KEPT: "host-kept",
      PI_CM_CHILD_VALUE: "case-value",
    });
  });

  test("puts back the environment from before the case when the case ends", async (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], {
      PI_CM_CHILD_KEPT: "host-kept",
      PI_CM_CHILD_DROPPED: "host-dropped",
    });
    t.mock.property(process, "platform", "linux");
    const environmentBefore = { ...process.env };

    // act
    await t.test("case", (caseContext) => {
      useAllowlistedProcessEnvironment(caseContext, ["PI_CM_CHILD_KEPT"], {
        PI_CM_CHILD_VALUE: "case-value",
      });
      process.env.PI_CM_CHILD_KEPT = "case-changed";
      process.env.PI_CM_CHILD_ADDED = "added-by-code-under-test";
    });

    // assert
    assert.deepStrictEqual({ ...process.env }, environmentBefore);
  });

  test("puts back HOME and PI_CODING_AGENT_DIR when createHermeticEnvironment runs first", async (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], {
      HOME: "/case/home",
      PI_CODING_AGENT_DIR: "/case/home/.pi/agent",
    });
    const environmentBefore = { ...process.env };
    let piLocationsInCase: Record<string, string | undefined> = {};
    let hermeticLocations: Record<string, string | undefined> = {};

    // act
    await t.test("case", async (caseContext) => {
      const { home, agentDir } = await createHermeticEnvironment(
        caseContext,
        "child-environment-first-",
      );
      useAllowlistedProcessEnvironment(caseContext, ["HOME", "PI_CODING_AGENT_DIR"]);
      hermeticLocations = { HOME: home, PI_CODING_AGENT_DIR: agentDir };
      piLocationsInCase = {
        HOME: process.env.HOME,
        PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
      };
    });

    // assert
    assert.deepStrictEqual(piLocationsInCase, hermeticLocations);
    assert.deepStrictEqual({ ...process.env }, environmentBefore);
  });

  test("puts back HOME and PI_CODING_AGENT_DIR when createHermeticEnvironment runs after a call that drops them", async (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], {
      HOME: "/case/home",
      PI_CODING_AGENT_DIR: "/case/home/.pi/agent",
    });
    const environmentBefore = { ...process.env };
    let piLocationsInCase: Record<string, string | undefined> = {};
    let hermeticLocations: Record<string, string | undefined> = {};

    // act
    await t.test("case", async (caseContext) => {
      useAllowlistedProcessEnvironment(caseContext, []);
      const { home, agentDir } = await createHermeticEnvironment(
        caseContext,
        "child-environment-second-",
      );
      hermeticLocations = { HOME: home, PI_CODING_AGENT_DIR: agentDir };
      piLocationsInCase = {
        HOME: process.env.HOME,
        PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
      };
    });

    // assert
    assert.deepStrictEqual(piLocationsInCase, hermeticLocations);
    assert.deepStrictEqual({ ...process.env }, environmentBefore);
  });

  test("puts back the environment from before the first of two calls in one case", async (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], { PI_CM_CHILD_KEPT: "host-kept" });
    t.mock.property(process, "platform", "linux");
    const environmentBefore = { ...process.env };
    let environmentInCase: NodeJS.ProcessEnv = {};

    // act
    await t.test("case", (caseContext) => {
      useAllowlistedProcessEnvironment(caseContext, [], { PI_CM_CHILD_FIRST: "first" });
      useAllowlistedProcessEnvironment(caseContext, [], { PI_CM_CHILD_SECOND: "second" });
      environmentInCase = { ...process.env };
    });

    // assert
    assert.deepStrictEqual(environmentInCase, { PI_CM_CHILD_SECOND: "second" });
    assert.deepStrictEqual({ ...process.env }, environmentBefore);
  });
});

describe("restoreEnvironmentAfter", () => {
  test("puts back a set variable and removes an unset one when the case ends", async (t) => {
    // arrange
    useAllowlistedProcessEnvironment(t, [], { PI_CM_CHILD_SET: "host-set" });
    const environmentBefore = { ...process.env };

    // act
    await t.test("case", (caseContext) => {
      restoreEnvironmentAfter(caseContext, ["PI_CM_CHILD_SET", "PI_CM_CHILD_UNSET"]);
      process.env.PI_CM_CHILD_SET = "case-changed";
      process.env.PI_CM_CHILD_UNSET = "case-set";
    });

    // assert
    assert.deepStrictEqual({ ...process.env }, environmentBefore);
  });
});
