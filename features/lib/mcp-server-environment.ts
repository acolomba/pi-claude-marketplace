/**
 * @fileoverview The Node preload that makes the MCP stub's echo show values
 * of its own environment (D-CF6-06, MENV-01, MENV-02).
 *
 * A fixture runs the stub as `node --import <this file> <stub> ...`, with
 * `STUB_TAG_FROM` in the server's `env` naming variables, separated by
 * commas. Before the stub starts, this module sets `STUB_TAG` to the values
 * of those variables, joined with commas, an unset one as the empty string.
 * The stub prefixes its echo with `STUB_TAG`, so the model sees the values
 * pi-mcp-adapter gave the server's process. `--import` keeps the stub's path
 * as `process.argv[1]`, so the stub still starts as itself. A cucumber worker
 * imports this module only for its URL and never sets `STUB_TAG_FROM`. This
 * module registers nothing.
 */

/** The URL of this file, which a stub server's `args` passes to `--import`. */
export const MCP_SERVER_ENVIRONMENT_PRELOAD = import.meta.url;

const names = process.env.STUB_TAG_FROM;
if (names !== undefined) {
  process.env.STUB_TAG = names
    .split(",")
    .map((name) => process.env[name] ?? "")
    .join(",");
}
