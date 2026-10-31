/** @fileoverview Checks the source fields accepted by marketplace-info assertions. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { DataTable } from "@cucumber/cucumber";

import { expectedInfoFields } from "../../features/lib/marketplace-info-fields.ts";

for (const { kind, url, owner, repo, identity } of [
  {
    kind: "url",
    url: "https://example.test/market.git",
    owner: "",
    repo: "",
    identity: [["source url", "https://example.test/market.git"]],
  },
  {
    kind: "github",
    url: "",
    owner: "acme",
    repo: "market",
    identity: [
      ["source owner", "acme"],
      ["source repo", "market"],
    ],
  },
]) {
  for (const { ref, expectedRef, title } of [
    { ref: "", expectedRef: [], title: "omits a blank ref" },
    { ref: "stable", expectedRef: [["source ref", "stable"]], title: "preserves a ref" },
  ]) {
    test(`${title} for a ${kind} source`, () => {
      // arrange
      const table = new DataTable([
        ["kind", "marketplace-info"],
        ["source kind", kind],
        ["source abs path", ""],
        ["source url", url],
        ["source owner", owner],
        ["source repo", repo],
        ["source ref", ref],
      ]);

      // act
      const fields = expectedInfoFields(table);

      // assert
      assert.deepStrictEqual(
        [...fields],
        [["kind", "marketplace-info"], ["source kind", kind], ...identity, ...expectedRef],
      );
    });
  }
}

for (const { kind, field, url, owner, repo } of [
  { kind: "path", field: "source abs path", url: "", owner: "", repo: "" },
  { kind: "url", field: "source url", url: "", owner: "", repo: "" },
  { kind: "github", field: "source owner", url: "", owner: "", repo: "market" },
  { kind: "github", field: "source repo", url: "", owner: "acme", repo: "" },
]) {
  test(`rejects a blank ${field} for a ${kind} source`, () => {
    // arrange
    const table = new DataTable([
      ["source kind", kind],
      ["source abs path", ""],
      ["source url", url],
      ["source owner", owner],
      ["source repo", repo],
      ["source ref", ""],
    ]);

    // act & assert
    assert.throws(() => expectedInfoFields(table), {
      name: "Error",
      message: `the ${kind} source requires "${field}"`,
    });
  });
}

for (const { kind, path, url, owner, repo, ref, field } of [
  {
    kind: "path",
    path: "/market",
    url: "",
    owner: "",
    repo: "",
    ref: "stable",
    field: "source ref",
  },
  {
    kind: "url",
    path: "/market",
    url: "https://example.test/market.git",
    owner: "",
    repo: "",
    ref: "",
    field: "source abs path",
  },
  {
    kind: "github",
    path: "",
    url: "https://example.test/market.git",
    owner: "acme",
    repo: "market",
    ref: "",
    field: "source url",
  },
]) {
  test(`rejects ${field} for a ${kind} source`, () => {
    // arrange
    const table = new DataTable([
      ["source kind", kind],
      ["source abs path", path],
      ["source url", url],
      ["source owner", owner],
      ["source repo", repo],
      ["source ref", ref],
    ]);

    // act & assert
    assert.throws(() => expectedInfoFields(table), {
      name: "Error",
      message: `the ${kind} source cannot state "${field}"`,
    });
  });
}
